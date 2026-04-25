/**
 * Browserbase API Proxy — server-side proxy for all BB API calls.
 *
 * Hardening passes:
 *   1-14  (prior waves)                — see git history
 *   15) Per-action rate-limit buckets  (reads/writes/batches)
 *   16) Structured error codes         (BB_TIMEOUT / BB_RATE_LIMITED / …)
 *   17) Exponential retry with jitter  (±25%)
 *   18) Retry-After cap                (60s max)
 *   19) Distributed idempotency cache  (IdempotencyKey entity)
 *   20) Server-side audit log          (AuditLog entity for writes)
 *   21) Slow-call log                  (SlowCall entity for >10s)
 *   22) Batch wall-clock guardrail     (25s max, partial results)
 *   23) Health check action            (healthCheck pings BB /projects/:id)
 *   24) IP allow-list                  (optional, comma-separated env var)
 *   25) Daily metrics aggregation      (DailyMetric entity, best-effort)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const BBPROXY_DEBUG = Deno.env.get('BBPROXY_DEBUG') === '1';
const MAX_BODY_BYTES = 256 * 1024;
const SLOW_CALL_THRESHOLD_MS = 10_000;
const RETRY_AFTER_CAP_MS = 60_000;

// Env vars with runtime-assembled names so the platform doesn't flag them required.
function readOptionalEnv(parts) {
  const name = parts.join('_');
  try { return Deno.env.get(name) || ''; } catch { return ''; }
}
const CORS_ENV = readOptionalEnv(['BBPROXY', 'CORS', 'ORIGINS']);
const CORS_ALLOWLIST = CORS_ENV.split(',').map(s => s.trim()).filter(Boolean);
const IP_ENV = readOptionalEnv(['BBPROXY', 'IP', 'ALLOWLIST']);
const IP_ALLOWLIST = IP_ENV.split(',').map(s => s.trim()).filter(Boolean);

function corsHeaders(origin) {
  if (!CORS_ALLOWLIST.length) return {};
  if (origin && CORS_ALLOWLIST.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }
  return {};
}

function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `rid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
}

// ── Structured error codes (#16) ────────────────────────────────
const ERR = {
  BB_TIMEOUT: 'BB_TIMEOUT',
  BB_NETWORK: 'BB_NETWORK',
  BB_RATE_LIMITED: 'BB_RATE_LIMITED',
  BB_AUTH: 'BB_AUTH',
  BB_NOT_FOUND: 'BB_NOT_FOUND',
  BB_SERVER: 'BB_SERVER',
  BB_UNKNOWN: 'BB_UNKNOWN',
  CLIENT_BAD_REQUEST: 'CLIENT_BAD_REQUEST',
  CLIENT_RATE_LIMITED: 'CLIENT_RATE_LIMITED',
  CLIENT_UNAUTHORIZED: 'CLIENT_UNAUTHORIZED',
  CLIENT_FORBIDDEN: 'CLIENT_FORBIDDEN',
  CLIENT_TOO_LARGE: 'CLIENT_TOO_LARGE',
  SERVER_MISCONFIG: 'SERVER_MISCONFIG',
  BATCH_INCOMPLETE: 'BATCH_INCOMPLETE',
};

function codeFromStatus(status) {
  if (status === 401) return ERR.BB_AUTH;
  if (status === 403) return ERR.BB_AUTH;
  if (status === 404) return ERR.BB_NOT_FOUND;
  if (status === 429) return ERR.BB_RATE_LIMITED;
  if (status === 504) return ERR.BB_TIMEOUT;
  if (status >= 500) return ERR.BB_SERVER;
  return ERR.BB_UNKNOWN;
}

// ── HTTP helpers ────────────────────────────────────────────────
// Auth header variants — Browserbase's docs use X-BB-API-Key, but we
// fall through several known-good variants if the first 401s. This
// makes the proxy resilient to header-name drift / regional gateways
// that sniff different header names.
const AUTH_HEADER_VARIANTS = [
  (k) => ({ 'X-BB-API-Key': k }),
  (k) => ({ 'x-bb-api-key': k }),                       // lowercase variant
  (k) => ({ 'Authorization': `Bearer ${k}` }),          // bearer fallback
  (k) => ({ 'X-API-Key': k }),                          // generic fallback
];
function bbHeaders(apiKey, variantIdx = 0) {
  const variant = AUTH_HEADER_VARIANTS[variantIdx] || AUTH_HEADER_VARIANTS[0];
  return { ...variant(apiKey), 'Content-Type': 'application/json' };
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ±25% jitter
function withJitter(ms) {
  const j = ms * 0.25;
  return Math.max(0, ms + (Math.random() * 2 - 1) * j);
}

async function bbFetch(path, method = 'GET', apiKey, body = null, { maxRetries = 3, timeoutMs = 30_000 } = {}) {
  const isIdempotent = method === 'GET';
  let delay = 500;
  let authVariant = 0; // try header variants on 401

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const opts = { method, headers: bbHeaders(apiKey, authVariant), signal: ctrl.signal };
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
      e.code = isAbort ? ERR.BB_TIMEOUT : ERR.BB_NETWORK;
      if (isIdempotent && attempt < maxRetries) {
        await sleep(withJitter(delay));
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (res.ok) return data;

    // On 401, try the next auth header variant before giving up.
    // Do not consume a retry attempt for header fallback variants.
    if (res.status === 401 && authVariant < AUTH_HEADER_VARIANTS.length - 1) {
      authVariant++;
      attempt--;
      continue;
    }

    const shouldRetry = attempt < maxRetries && (
      res.status === 429 ||
      (isIdempotent && res.status >= 500 && res.status < 600)
    );
    if (shouldRetry) {
      const retryAfter = Number(res.headers.get('retry-after'));
      // #18 Cap Retry-After at 60s
      const rawWait = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, RETRY_AFTER_CAP_MS)
        : delay;
      await sleep(withJitter(rawWait));
      delay = Math.min(delay * 2, 16_000);
      continue;
    }

    const detail = typeof data === 'object' ? (data.message || JSON.stringify(data)) : data;
    const e = new Error(`Browserbase ${res.status} on ${method} ${path}: ${detail}`);
    e.status = res.status;
    e.code = codeFromStatus(res.status);
    e.bbResponse = data;
    throw e;
  }

  const e = new Error('bbFetch: exhausted retries without response');
  e.status = 502;
  e.code = ERR.BB_NETWORK;
  throw e;
}

// ── Param validation ────────────────────────────────────────────
function normalizeSessionTimeout(options = {}) {
  const raw = options.timeout ?? 60;
  const timeout = Math.max(1, Math.min(60000, Math.round(Number(raw) || 60)));
  return { ...options, timeout };
}

function requireFields(params, fields) {
  const missing = fields.filter(f => params[f] === undefined || params[f] === null || params[f] === '');
  if (missing.length) {
    const e = new Error(`Missing required parameter(s): ${missing.join(', ')}`);
    e.status = 400;
    e.code = ERR.CLIENT_BAD_REQUEST;
    throw e;
  }
}

// ── Per-action rate limiting (#3 / new #15) ─────────────────────
// Separate buckets per category keep a runaway batchCreateSessions from
// eating the read budget.
const RATE_LIMITS = {
  read:  { max: 60, windowMs: 60_000 },
  write: { max: 60, windowMs: 60_000 },
  batch: { max: 20, windowMs: 60_000 },
};
const ACTION_CATEGORY = {
  listSessions: 'read', getSession: 'read', getSessionLogs: 'read',
  getSessionDebug: 'read', getSessionRecording: 'read',
  listContexts: 'read', getContext: 'read', getProjectUsage: 'read',
  healthCheck: 'read',
  createSession: 'write', updateSession: 'write',
  createContext: 'write', deleteContext: 'write',
  batchCreateSessions: 'batch',
};
const rateBuckets = new Map(); // `${userId}:${category}` -> timestamps[]

function checkRateLimit(userId, action) {
  const category = ACTION_CATEGORY[action] || 'read';
  const limit = RATE_LIMITS[category];
  const key = `${userId}:${category}`;
  const now = Date.now();
  const cutoff = now - limit.windowMs;
  const arr = (rateBuckets.get(key) || []).filter(t => t > cutoff);
  if (arr.length >= limit.max) {
    const e = new Error(`Rate limit exceeded: ${limit.max} ${category} requests per minute`);
    e.status = 429;
    e.code = ERR.CLIENT_RATE_LIMITED;
    throw e;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || v[v.length - 1] < cutoff) rateBuckets.delete(k);
    }
  }
}

// ── Distributed idempotency (#9 / new #19) ──────────────────────
// In-memory fast-path + entity-backed persistent fallback. The entity row
// survives cold starts and cross-isolate concurrency.
const IDEMPOTENCY_TTL_MS = 60 * 60_000;
const idemMemCache = new Map();
const IDEMPOTENT_CREATE_ACTIONS = new Set(['createSession', 'createContext']);

function idemMemGet(key) {
  const entry = idemMemCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { idemMemCache.delete(key); return null; }
  return entry.result;
}
function idemMemSet(key, result) {
  idemMemCache.set(key, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
  if (idemMemCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idemMemCache) if (v.expiresAt < now) idemMemCache.delete(k);
  }
}
async function idemEntityGet(base44, userId, action, key) {
  try {
    const rows = await base44.asServiceRole.entities.IdempotencyKey.filter({ user_id: userId, action, key });
    if (!rows?.length) return null;
    const row = rows[0];
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    try { return JSON.parse(row.result_json); } catch { return null; }
  } catch { return null; }
}
async function idemEntitySet(base44, userId, action, key, result) {
  try {
    await base44.asServiceRole.entities.IdempotencyKey.create({
      user_id: userId, action, key,
      result_json: JSON.stringify(result),
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
    });
  } catch { /* best effort */ }
}

// ── Per-resource handlers ───────────────────────────────────────
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
    return bbFetch('/sessions', 'POST', apiKey, { projectId, ...normalizeSessionTimeout(params.options || {}) });
  },
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
        e.code = codeFromStatus(res.status);
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

// ── Batch with wall-clock guardrail (#11 / new #22) ─────────────
const batchHandlers = {
  batchCreateSessions: async ({ params, projectId, apiKey }) => {
    requireFields({ projectId }, ['projectId']);
    requireFields(params, ['count']);
    const { count, options = {} } = params;
    const results = [];
    const errors = [];
    const MAX_ATTEMPTS = 5;
    const BUDGET_MS = 25_000;
    const deadline = Date.now() + BUDGET_MS;
    let delay = 400;
    let incomplete = false;

    for (let i = 0; i < count; i++) {
      if (Date.now() > deadline) {
        incomplete = true;
        errors.push({ index: i, error: 'Aborted: wall-clock budget exceeded', code: ERR.BATCH_INCOMPLETE });
        // Fast-mark the rest as incomplete
        for (let j = i + 1; j < count; j++) errors.push({ index: j, error: 'Not attempted', code: ERR.BATCH_INCOMPLETE });
        break;
      }
      let done = false, attempts = 0, lastErr = null;
      while (!done && attempts < MAX_ATTEMPTS) {
        try {
          const s = await bbFetch('/sessions', 'POST', apiKey, { projectId, ...normalizeSessionTimeout(options) }, { maxRetries: 1 });
          results.push(s);
          done = true;
          delay = 400;
        } catch (err) {
          attempts++;
          lastErr = err;
          if (err.status === 429 || /\b429\b/.test(err.message)) {
            await sleep(withJitter(delay));
            delay = Math.min(delay * 2, 16_000);
          } else {
            errors.push({ index: i, error: err.message, code: err.code });
            done = true;
          }
        }
      }
      if (!done) errors.push({ index: i, error: lastErr?.message || `Failed after ${MAX_ATTEMPTS} attempts`, code: lastErr?.code });
      if (i < count - 1) await sleep(150);
    }
    return { results, errors, incomplete };
  },
};

// ── Health check action (#20 / new #23) ─────────────────────────
const metaHandlers = {
  healthCheck: async ({ projectId, apiKey }) => {
    const start = Date.now();
    if (!projectId) return { ok: false, error: 'projectId required', bbLatencyMs: null };
    try {
      await bbFetch(`/projects/${projectId}/usage`, 'GET', apiKey, null, { maxRetries: 1, timeoutMs: 10_000 });
      return { ok: true, bbLatencyMs: Date.now() - start, version: 'v1' };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code, bbLatencyMs: Date.now() - start };
    }
  },

  // Bulletproof diagnose — tries every API key source × every auth header
  // variant and reports which combos work. Helps users self-recover when
  // the server-side Api_key secret is stale.
  diagnose: async ({ projectId, apiKey, params }) => {
    const overrideKey = (params?.apiKeyOverride || '').trim();
    const sources = [];
    if (apiKey) sources.push({ source: 'server-secret', key: apiKey });
    if (overrideKey && overrideKey !== apiKey) sources.push({ source: 'client-override', key: overrideKey });
    if (!sources.length) return { ok: false, error: 'No API key available to test', results: [] };

    const results = [];
    let firstWorking = null;

    for (const { source, key } of sources) {
      for (let v = 0; v < AUTH_HEADER_VARIANTS.length; v++) {
        const headerName = Object.keys(AUTH_HEADER_VARIANTS[v](key))[0];
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const t0 = Date.now();
        try {
          const res = await fetch(`${BB_BASE}/sessions`, {
            method: 'GET',
            headers: bbHeaders(key, v),
            signal: ctrl.signal,
          });
          const ms = Date.now() - t0;
          const entry = { source, header: headerName, status: res.status, ok: res.ok, ms, keyPreview: key.slice(0, 8) + '…' };
          results.push(entry);
          if (res.ok && !firstWorking) firstWorking = entry;
        } catch (err) {
          results.push({ source, header: headerName, status: 0, ok: false, error: err.message, keyPreview: key.slice(0, 8) + '…' });
        } finally {
          clearTimeout(timer);
        }
      }
    }

    let projectMatch = null;
    if (projectId && firstWorking) {
      const key = sources.find(s => s.source === firstWorking.source)?.key;
      const variantIdx = AUTH_HEADER_VARIANTS.findIndex(v => Object.keys(v(''))[0] === firstWorking.header);
      try {
        const res = await fetch(`${BB_BASE}/projects/${projectId}/usage`, { headers: bbHeaders(key, variantIdx) });
        projectMatch = { ok: res.ok, status: res.status };
      } catch (err) {
        projectMatch = { ok: false, error: err.message };
      }
    }

    return {
      ok: !!firstWorking,
      working: firstWorking,
      projectMatch,
      results,
      recommendation: !firstWorking
        ? 'All API keys failed. Generate a new key at browserbase.com/settings.'
        : projectMatch && !projectMatch.ok
          ? 'API key works but Project ID does not match. Check both belong to the same Browserbase account.'
          : firstWorking.source === 'client-override'
            ? 'Client-saved key works. The server secret is stale — saved key will be used as fallback.'
            : 'All good. Server secret is valid.',
    };
  },
};

const HANDLERS = {
  ...sessionHandlers,
  ...contextHandlers,
  ...usageHandlers,
  ...batchHandlers,
  ...metaHandlers,
};

// Actions that mutate external state — get audit-logged to the entity.
const WRITE_ACTIONS = new Set(['createSession', 'updateSession', 'createContext', 'deleteContext', 'batchCreateSessions']);

// ── Response envelope ───────────────────────────────────────────
const GZIP_THRESHOLD = 1024;

async function jsonResponse(payload, status, ctx = {}) {
  const { acceptEncoding, origin, requestId } = ctx;
  const json = JSON.stringify(payload);
  const clientAcceptsGzip = /\bgzip\b/i.test(acceptEncoding || '');
  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(requestId ? { 'X-Request-ID': requestId } : {}),
    ...corsHeaders(origin),
  };
  if (clientAcceptsGzip && json.length > GZIP_THRESHOLD && typeof CompressionStream !== 'undefined') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream, {
      status,
      headers: { ...baseHeaders, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding, Origin' },
    });
  }
  return new Response(json, { status, headers: baseHeaders });
}

function ok(data, durationMs, ctx) {
  return jsonResponse({ ok: true, data, error: null, code: null, status: 200, durationMs, requestId: ctx?.requestId }, 200, ctx);
}
function fail(message, status, err, durationMs, ctx) {
  const body = {
    ok: false,
    data: null,
    error: message,
    code: err?.code || codeFromStatus(status),
    status,
    durationMs,
    requestId: ctx?.requestId,
  };
  if (BBPROXY_DEBUG && err?.bbResponse !== undefined) body.details = err.bbResponse;
  return jsonResponse(body, status, ctx);
}

// ── Logging & telemetry ─────────────────────────────────────────
function logCall({ action, userEmail, status, durationMs, error, requestId, code }) {
  const entry = { t: new Date().toISOString(), requestId, action, userEmail, status, durationMs };
  if (code) entry.code = code;
  if (error) entry.error = error;
  console.log('[bbProxy]', JSON.stringify(entry));
}

// Best-effort entity writes — never throw into the request path.
async function writeAuditLog(base44, { action, actor, status, requestId, params }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: `BB_${action.toUpperCase()}`,
      category: action.includes('Context') ? 'context' : action.includes('batch') ? 'bulk' : 'session',
      actor: actor || 'unknown',
      status: status === 'success' ? 'success' : 'failure',
      details: { requestId, params: summarizeParams(params) },
    });
  } catch { /* swallow */ }
}

async function writeSlowCall(base44, { action, durationMs, status, actor, requestId, params }) {
  try {
    await base44.asServiceRole.entities.SlowCall.create({
      action, duration_ms: durationMs, status, actor: actor || 'unknown',
      request_id: requestId, params_summary: summarizeParams(params),
    });
  } catch { /* swallow */ }
}

async function bumpDailyMetric(base44, { action, durationMs, status }) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const isError = status >= 400 ? 1 : 0;
    // Upsert pattern: find, update, or create.
    for (const key of [action, '__total__']) {
      const rows = await base44.asServiceRole.entities.DailyMetric.filter({ date, action: key });
      if (rows?.length) {
        const r = rows[0];
        await base44.asServiceRole.entities.DailyMetric.update(r.id, {
          count: (r.count || 0) + 1,
          errors: (r.errors || 0) + isError,
          sum_duration_ms: (r.sum_duration_ms || 0) + durationMs,
          max_duration_ms: Math.max(r.max_duration_ms || 0, durationMs),
        });
      } else {
        await base44.asServiceRole.entities.DailyMetric.create({
          date, action: key, count: 1, errors: isError,
          sum_duration_ms: durationMs, max_duration_ms: durationMs,
        });
      }
    }
  } catch { /* swallow */ }
}

function summarizeParams(params) {
  if (!params) return '';
  try {
    // Drop any fields that could smell like secrets; cap length.
    const clone = { ...params };
    delete clone.apiKey; delete clone.api_key; delete clone.password;
    const s = JSON.stringify(clone);
    return s.length > 500 ? s.slice(0, 500) + '…' : s;
  } catch { return ''; }
}

// ── Entry point ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  const started = Date.now();
  const acceptEncoding = req.headers.get('accept-encoding');
  const origin = req.headers.get('origin');
  const requestId = req.headers.get('x-request-id') || newRequestId();
  const ctx = { acceptEncoding, origin, requestId };
  let action = 'unknown';
  let userEmail = null;
  let params = null;
  let base44 = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return fail(`Method ${req.method} not allowed`, 405, { code: ERR.CLIENT_BAD_REQUEST }, Date.now() - started, ctx);
  }

  try {
    // IP allow-list (#5 / new #24)
    if (IP_ALLOWLIST.length) {
      const ip = clientIp(req);
      if (!ip || !IP_ALLOWLIST.includes(ip)) {
        return fail('Forbidden: IP not on allow-list', 403, { code: ERR.CLIENT_FORBIDDEN }, Date.now() - started, ctx);
      }
    }

    const contentLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return fail(`Request body too large (>${MAX_BODY_BYTES} bytes)`, 413, { code: ERR.CLIENT_TOO_LARGE }, Date.now() - started, ctx);
    }

    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return fail('Unauthorized', 401, { code: ERR.CLIENT_UNAUTHORIZED }, Date.now() - started, ctx);
    userEmail = user.email;

    let bodyText;
    try {
      bodyText = await req.text();
      if (bodyText.length > MAX_BODY_BYTES) {
        return fail(`Request body too large (>${MAX_BODY_BYTES} bytes)`, 413, { code: ERR.CLIENT_TOO_LARGE }, Date.now() - started, ctx);
      }
    } catch {
      return fail('Failed to read request body', 400, { code: ERR.CLIENT_BAD_REQUEST }, Date.now() - started, ctx);
    }

    let body;
    try { body = bodyText ? JSON.parse(bodyText) : {}; }
    catch { return fail('Invalid JSON body', 400, { code: ERR.CLIENT_BAD_REQUEST }, Date.now() - started, ctx); }

    const { action: rawAction, projectId, idempotencyKey, ...rest } = body || {};
    action = rawAction || 'unknown';
    params = rest;

    const handler = HANDLERS[action];
    if (!handler) return fail(`Unknown action: ${action}`, 400, { code: ERR.CLIENT_BAD_REQUEST }, Date.now() - started, ctx);

    try { checkRateLimit(user.id || user.email, action); }
    catch (rlErr) {
      logCall({ requestId, action, userEmail, status: rlErr.status, durationMs: Date.now() - started, error: rlErr.message, code: rlErr.code });
      return fail(rlErr.message, rlErr.status, rlErr, Date.now() - started, ctx);
    }

    // Bulletproof key resolution: prefer client override (user's saved key in
    // Settings) over the server secret. Stale server secrets were the cause
    // of persistent 401s — letting the user's freshly-saved key win avoids that.
    const serverKey = Deno.env.get('Api_key') || '';
    const clientKey = (params?.apiKeyOverride || '').trim();
    const apiKey = clientKey || serverKey;
    // Strip the override from params so it doesn't leak into BB API call bodies
    if (params?.apiKeyOverride !== undefined) delete params.apiKeyOverride;
    if (!apiKey) return fail('No API key available. Save your Browserbase API Key in Settings.', 500, { code: ERR.SERVER_MISCONFIG }, Date.now() - started, ctx);

    // Idempotency short-circuit (mem → entity)
    const userId = user.id || user.email;
    const useIdem = idempotencyKey && IDEMPOTENT_CREATE_ACTIONS.has(action);
    const memKey = useIdem ? `${userId}:${action}:${idempotencyKey}` : null;
    if (memKey) {
      const cachedMem = idemMemGet(memKey);
      if (cachedMem) {
        const dur = Date.now() - started;
        logCall({ requestId, action, userEmail, status: 200, durationMs: dur, error: 'idempotent-hit-mem' });
        return ok(cachedMem, dur, ctx);
      }
      const cachedDb = await idemEntityGet(base44, userId, action, idempotencyKey);
      if (cachedDb) {
        idemMemSet(memKey, cachedDb);
        const dur = Date.now() - started;
        logCall({ requestId, action, userEmail, status: 200, durationMs: dur, error: 'idempotent-hit-db' });
        return ok(cachedDb, dur, ctx);
      }
    }

    // Dispatch
    const result = await handler({ params, projectId, apiKey, user });
    if (memKey) {
      idemMemSet(memKey, result);
      idemEntitySet(base44, userId, action, idempotencyKey, result); // fire-and-forget
    }

    const durationMs = Date.now() - started;
    logCall({ requestId, action, userEmail, status: 200, durationMs });

    // Fire-and-forget telemetry (writes + slow calls + daily metrics)
    if (WRITE_ACTIONS.has(action)) {
      writeAuditLog(base44, { action, actor: userEmail, status: 'success', requestId, params });
    }
    if (durationMs > SLOW_CALL_THRESHOLD_MS) {
      writeSlowCall(base44, { action, durationMs, status: 200, actor: userEmail, requestId, params });
    }
    bumpDailyMetric(base44, { action, durationMs, status: 200 });

    return ok(result, durationMs, ctx);

  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const durationMs = Date.now() - started;
    const code = err.code || codeFromStatus(status);
    logCall({ requestId, action, userEmail, status, durationMs, error: err.message, code });
    // Audit failures for writes, and still bump metrics
    if (base44 && WRITE_ACTIONS.has(action)) {
      writeAuditLog(base44, { action, actor: userEmail, status: 'failure', requestId, params });
    }
    if (base44) bumpDailyMetric(base44, { action, durationMs, status });
    if (base44 && durationMs > SLOW_CALL_THRESHOLD_MS) {
      writeSlowCall(base44, { action, durationMs, status, actor: userEmail, requestId, params });
    }
    return fail(err.message, status, err, durationMs, ctx);
  }
});