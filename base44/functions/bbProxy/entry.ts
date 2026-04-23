/**
 * Browserbase API Proxy — server-side proxy for all BB API calls.
 *
 * Entry point dispatches { action, ...params } to per-resource handlers.
 * Improvements in this version:
 *   1) Request timeout (AbortController, 30s)
 *   2) Retry w/ backoff on 429/5xx inside bbFetch (single-call actions benefit)
 *   3) Action allow-list validation up front
 *   4) Per-action param schema validation
 *   5) Consistent envelope: { ok, data, error, status, details, durationMs }
 *   6) Per-user rate limiting (60 req/min/user, in-memory)
 *   7) Structured logging: { action, userEmail, status, durationMs }
 *   8) Idempotency keys for createSession / createContext (10-min window)
 *   9) Debug details gated by BBPROXY_DEBUG env flag
 *  10) Per-resource handler modules (sessions / contexts / usage / batch)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const BBPROXY_DEBUG = Deno.env.get('BBPROXY_DEBUG') === '1';

// ── HTTP helpers ────────────────────────────────────────────────
function bbHeaders(apiKey) {
  return { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch Browserbase with: 30s timeout, retry on 429/5xx, structured errors.
 * Non-idempotent methods (POST/DELETE) only retry on 429 (not 5xx) to avoid
 * duplicate resource creation.
 */
async function bbFetch(path, method = 'GET', apiKey, body = null, { maxRetries = 3, timeoutMs = 30_000 } = {}) {
  const isIdempotent = method === 'GET';
  let delay = 500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const opts = { method, headers: bbHeaders(apiKey), signal: ctrl.signal };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${BB_BASE}${path}`, opts);
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const e = new Error(isAbort
        ? `Browserbase request timed out after ${timeoutMs}ms (${method} ${path})`
        : `Network error calling Browserbase: ${err.message}`);
      e.status = isAbort ? 504 : 502;
      // Retry network errors on idempotent calls only
      if (isIdempotent && attempt < maxRetries) { await sleep(delay); delay = Math.min(delay * 2, 8000); continue; }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (res.ok) return data;

    const shouldRetry = attempt < maxRetries && (
      res.status === 429 ||
      (isIdempotent && res.status >= 500 && res.status < 600)
    );
    if (shouldRetry) {
      // Honor Retry-After when present
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      await sleep(wait);
      delay = Math.min(delay * 2, 16_000);
      continue;
    }

    const detail = typeof data === 'object' ? (data.message || JSON.stringify(data)) : data;
    const e = new Error(`Browserbase ${res.status} on ${method} ${path}: ${detail}`);
    e.status = res.status;
    e.bbResponse = data;
    throw e;
  }

  // Unreachable, but keeps linter happy
  const e = new Error('bbFetch: exhausted retries without response');
  e.status = 502;
  throw e;
}

// ── Param validation (#4) ───────────────────────────────────────
function requireFields(params, fields) {
  const missing = fields.filter(f => params[f] === undefined || params[f] === null || params[f] === '');
  if (missing.length) {
    const e = new Error(`Missing required parameter(s): ${missing.join(', ')}`);
    e.status = 400;
    throw e;
  }
}

// ── Per-user rate limiting (#6) ─────────────────────────────────
// 60 requests per rolling 60s window, per user id. In-memory — resets on cold
// start, which is fine for abuse protection.
const RATE_LIMIT = { max: 60, windowMs: 60_000 };
const rateBuckets = new Map(); // userId -> number[] of timestamps

function checkRateLimit(userId) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT.windowMs;
  const arr = (rateBuckets.get(userId) || []).filter(t => t > cutoff);
  if (arr.length >= RATE_LIMIT.max) {
    const e = new Error(`Rate limit exceeded: ${RATE_LIMIT.max} requests per minute`);
    e.status = 429;
    throw e;
  }
  arr.push(now);
  rateBuckets.set(userId, arr);
  // Opportunistic cleanup
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || v[v.length - 1] < cutoff) rateBuckets.delete(k);
    }
  }
}

// ── Idempotency cache (#8) ──────────────────────────────────────
// Keyed by `${userId}:${action}:${idempotencyKey}`. TTL 10 min.
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const idempotencyCache = new Map(); // key -> { result, expiresAt }

function idempotencyGet(key) {
  const entry = idempotencyCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { idempotencyCache.delete(key); return null; }
  return entry.result;
}
function idempotencySet(key, result) {
  idempotencyCache.set(key, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache) if (v.expiresAt < now) idempotencyCache.delete(k);
  }
}

// ── Per-resource handlers (#10) ─────────────────────────────────
const sessionHandlers = {
  listSessions: async ({ params, apiKey }) => {
    const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
    return bbFetch(`/sessions${qs}`, 'GET', apiKey);
  },
  getSession: async ({ params, apiKey }) => {
    requireFields(params, ['sessionId']);
    return bbFetch(`/sessions/${params.sessionId}`, 'GET', apiKey);
  },
  createSession: async ({ params, projectId, apiKey }) => {
    requireFields({ projectId }, ['projectId']);
    return bbFetch('/sessions', 'POST', apiKey, { projectId, ...(params.options || {}) });
  },
  // BB update-session uses POST. userMetadata broadcast vs REQUEST_RELEASE.
  updateSession: async ({ params, projectId, apiKey }) => {
    requireFields(params, ['sessionId']);
    const updateData = params.data;
    const payload = updateData?.userMetadata
      ? { userMetadata: updateData.userMetadata }
      : { status: 'REQUEST_RELEASE' };
    if (projectId) payload.projectId = projectId;
    return bbFetch(`/sessions/${params.sessionId}`, 'POST', apiKey, payload);
  },
  getSessionLogs: async ({ params, apiKey }) => {
    requireFields(params, ['sessionId']);
    return bbFetch(`/sessions/${params.sessionId}/logs`, 'GET', apiKey);
  },
  getSessionDebug: async ({ params, apiKey }) => {
    requireFields(params, ['sessionId']);
    return bbFetch(`/sessions/${params.sessionId}/debug`, 'GET', apiKey);
  },
  getSessionRecording: async () => ({
    deprecated: true,
    message: 'The Browserbase Session Recording API has been deprecated. Contact support@browserbase.com for alternatives.',
  }),
};

const contextHandlers = {
  listContexts: async () => ({
    items: [],
    note: 'Browserbase does not provide a list-all-contexts endpoint. Contexts are retrieved by ID.',
  }),
  getContext: async ({ params, apiKey }) => {
    requireFields(params, ['contextId']);
    return bbFetch(`/contexts/${params.contextId}`, 'GET', apiKey);
  },
  createContext: async ({ projectId, apiKey }) => {
    requireFields({ projectId }, ['projectId']);
    return bbFetch('/contexts', 'POST', apiKey, { projectId });
  },
  deleteContext: async ({ params, apiKey }) => {
    requireFields(params, ['contextId']);
    // DELETE returns 204 w/ no body — bbFetch would JSON-parse empty fine,
    // but we special-case to return { ok: true } for API consistency.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(`${BB_BASE}/contexts/${params.contextId}`, {
        method: 'DELETE', headers: bbHeaders(apiKey), signal: ctrl.signal,
      });
      if (res.status === 204) return { ok: true };
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(`Browserbase ${res.status} on DELETE /contexts/${params.contextId}: ${body.message || ''}`);
        e.status = res.status;
        e.bbResponse = body;
        throw e;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  },
};

const usageHandlers = {
  getProjectUsage: async ({ projectId, apiKey }) => {
    requireFields({ projectId }, ['projectId']);
    return bbFetch(`/projects/${projectId}/usage`, 'GET', apiKey);
  },
};

const batchHandlers = {
  batchCreateSessions: async ({ params, projectId, apiKey }) => {
    requireFields({ projectId }, ['projectId']);
    requireFields(params, ['count']);
    const { count, options = {} } = params;
    const results = [];
    const errors = [];
    const MAX_ATTEMPTS = 5;
    let delay = 400;
    for (let i = 0; i < count; i++) {
      let done = false, attempts = 0, lastErr = null;
      while (!done && attempts < MAX_ATTEMPTS) {
        try {
          const s = await bbFetch('/sessions', 'POST', apiKey, { projectId, ...options }, { maxRetries: 1 });
          results.push(s);
          done = true;
          delay = 400;
        } catch (err) {
          attempts++;
          lastErr = err;
          if (err.status === 429 || /\b429\b/.test(err.message)) {
            await sleep(delay);
            delay = Math.min(delay * 2, 16_000);
          } else {
            errors.push({ index: i, error: err.message });
            done = true;
          }
        }
      }
      if (!done) errors.push({ index: i, error: lastErr?.message || `Failed after ${MAX_ATTEMPTS} attempts` });
      if (i < count - 1) await sleep(150);
    }
    return { results, errors };
  },
};

// Allow-list (#3) — merged across resources. Unknown actions rejected early.
const HANDLERS = {
  ...sessionHandlers,
  ...contextHandlers,
  ...usageHandlers,
  ...batchHandlers,
};

// Actions that support idempotency keys (#8)
const IDEMPOTENT_CREATE_ACTIONS = new Set(['createSession', 'createContext']);

// ── Response envelope (#5, #9) ──────────────────────────────────
function ok(data, durationMs) {
  return Response.json({ ok: true, data, error: null, status: 200, durationMs });
}
function fail(message, status, err, durationMs) {
  const body = { ok: false, data: null, error: message, status, durationMs };
  if (BBPROXY_DEBUG && err?.bbResponse !== undefined) body.details = err.bbResponse;
  return Response.json(body, { status });
}

// ── Structured logging (#7) ─────────────────────────────────────
function logCall({ action, userEmail, status, durationMs, error }) {
  const entry = { t: new Date().toISOString(), action, userEmail, status, durationMs };
  if (error) entry.error = error;
  console.log('[bbProxy]', JSON.stringify(entry));
}

// ── Entry point ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  const started = Date.now();
  let action = 'unknown';
  let userEmail = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return fail('Unauthorized', 401, null, Date.now() - started);
    userEmail = user.email;

    let body;
    try { body = await req.json(); }
    catch { return fail('Invalid JSON body', 400, null, Date.now() - started); }

    const { action: rawAction, projectId, idempotencyKey, ...params } = body || {};
    action = rawAction || 'unknown';

    // #3 Allow-list check
    const handler = HANDLERS[action];
    if (!handler) return fail(`Unknown action: ${action}`, 400, null, Date.now() - started);

    // #6 Rate limit (per user)
    try { checkRateLimit(user.id || user.email); }
    catch (rlErr) {
      logCall({ action, userEmail, status: rlErr.status, durationMs: Date.now() - started, error: rlErr.message });
      return fail(rlErr.message, rlErr.status, null, Date.now() - started);
    }

    const apiKey = Deno.env.get('Api_key');
    if (!apiKey) return fail('Server misconfiguration: Api_key secret is not set', 500, null, Date.now() - started);

    // #8 Idempotency short-circuit (createSession / createContext only)
    const idemKey = (idempotencyKey && IDEMPOTENT_CREATE_ACTIONS.has(action))
      ? `${user.id || user.email}:${action}:${idempotencyKey}`
      : null;
    if (idemKey) {
      const cached = idempotencyGet(idemKey);
      if (cached) {
        const dur = Date.now() - started;
        logCall({ action, userEmail, status: 200, durationMs: dur, error: 'idempotent-hit' });
        return ok(cached, dur);
      }
    }

    // Dispatch
    const result = await handler({ params, projectId, apiKey, user });
    if (idemKey) idempotencySet(idemKey, result);

    const durationMs = Date.now() - started;
    logCall({ action, userEmail, status: 200, durationMs });
    return ok(result, durationMs);

  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const durationMs = Date.now() - started;
    logCall({ action, userEmail, status, durationMs, error: err.message });
    return fail(err.message, status, err, durationMs);
  }
});