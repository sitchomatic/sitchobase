/**
 * Frontend client for Browserbase API calls.
 *
 * Two transports, chosen at call time:
 *   1. Direct — bypass the bbProxy Base44 function and hit Browserbase's REST
 *      API directly from the browser via the Vite dev proxy (/bb/v1). Used
 *      when we are running with VITE_BASE44_API_KEY set (local dev only) AND
 *      a Browserbase API key is stored in bb_credentials. This is the path
 *      that actually works under api_key auth — bbProxy rejects it.
 *   2. bbProxy — the original path. Routes the same calls through a Base44
 *      server function that proxies to Browserbase. Requires a real user
 *      session (interactive Google login), so it is the right transport for
 *      production and for locally-logged-in users.
 */
import { base44 } from '@/api/base44Client';
import * as bb from './browserbaseApi';
import { createCircuitBreaker, CircuitOpenError } from './circuitBreaker';

// Cost constants (Browserbase pricing — update if pricing changes)
export const BB_COST_PER_MINUTE = 0.009; // USD per browser minute

// ── Circuit breaker (shared across all bbClient calls) ──────────
const circuit = createCircuitBreaker({
  failureThreshold: 10,
  failureWindowMs: 60_000,
  cooldownMs: 30_000,
});
export const getCircuitState = () => circuit.getState();
export const resetCircuit = () => circuit.reset();

// ── Request ID tracking (for debugging correlated failures) ─────
let lastRequestId = null;
export const getLastRequestId = () => lastRequestId;

// True when the Base44 SDK is authenticated via an `api_key` header (local dev
// shortcut) instead of an interactive user session. Exposed for UIs that want
// to branch on auth mode.
export const isUsingApiKeyAuth = () => Boolean(import.meta.env.VITE_BASE44_API_KEY);

let credentialCacheRaw = null;
let credentialCache = {};

function readStoredCredentials() {
  try {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('bb_credentials')
      : null;
    if (!stored) {
      credentialCacheRaw = null;
      credentialCache = {};
      return credentialCache;
    }
    if (stored === credentialCacheRaw) return credentialCache;

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      credentialCacheRaw = stored;
      credentialCache = {};
      return credentialCache;
    }

    credentialCacheRaw = stored;
    credentialCache = {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId.trim() : '',
    };
    return credentialCache;
  } catch {
    credentialCacheRaw = null;
    credentialCache = {};
    return credentialCache;
  }
}

// True when we can — and should — talk to Browserbase directly from the
// browser instead of routing through bbProxy. Requires: api_key auth mode
// (so bbProxy would fail anyway), a running Vite dev server (for the /bb
// CORS proxy), and stored Browserbase credentials with both a non-empty
// API key and project ID. projectId is required up front (not per-action)
// so the Settings "direct API" banner never lights up for a configuration
// that would fail the moment a projectId-bound call is made (createSession,
// getProjectUsage, createContext, batchCreateSessions).
// Exposed so UIs can skip the old "bbProxy doesn't support api_key" limitation
// banner when the direct path is available.
export function canUseDirectBrowserbase(creds) {
  if (!isUsingApiKeyAuth()) return false;
  // import.meta.env.DEV is only true under `vite` / `vite build --mode development`.
  // Production builds must continue to go through bbProxy.
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return false;
  // Accept already-parsed creds so hot paths (callOnce) don't parse
  // localStorage twice on every API call.
  const { apiKey, projectId } = creds ?? readStoredCredentials();
  return (
    typeof apiKey === 'string' &&
    apiKey.trim().length > 0 &&
    typeof projectId === 'string' &&
    projectId.trim().length > 0
  );
}

// Kept for external callers — bbProxy-only limitation UX in surfaces where
// the direct path cannot help.
export const API_KEY_BBPROXY_MESSAGE =
  'This action uses the bbProxy Base44 function, which only works with an ' +
  'interactive Google login — not the local VITE_BASE44_API_KEY. Unset ' +
  'VITE_BASE44_API_KEY and sign in via Base44 to use it.';

async function callOnce(action, extras = {}, { signal } = {}) {
  const creds = readStoredCredentials();
  if (canUseDirectBrowserbase(creds)) {
    return callDirect(action, extras, creds, { signal });
  }
  const payload = { action, ...extras };
  if (creds.projectId) payload.projectId = creds.projectId;
  // Bulletproof fallback: forward the user's saved API key as an override so
  // the proxy can use it when the server-side secret is stale or missing.
  if (creds.apiKey) payload.apiKeyOverride = creds.apiKey;
  try {
    // Pass AbortSignal through when invoke() supports it (best-effort)
    const res = await base44.functions.invoke('bbProxy', payload, signal ? { signal } : undefined);
    // Capture request ID for debugging correlation
    const rid = res?.data?.requestId ?? res?.headers?.['x-request-id'] ?? null;
    if (rid) lastRequestId = rid;
    // New envelope: { ok, data, error, status, durationMs, details?, requestId? }
    // Legacy envelope: { data }
    const env = res.data ?? {};
    if (env.ok === false) {
      const e = new Error(env.error || 'bbProxy call failed');
      e.status = env.status;
      e.code = env.code || null;
      e.details = env.details;
      e.requestId = env.requestId ?? rid ?? null;
      throw e;
    }
    // env.data is the Browserbase payload in both envelopes
    return env.data;
  } catch (err) {
    if (isUsingApiKeyAuth() && isLikelyApiKeyBbProxyFailure(err)) {
      const wrapped = new Error(API_KEY_BBPROXY_MESSAGE);
      wrapped.isApiKeyBbProxyLimitation = true;
      wrapped.cause = err;
      throw wrapped;
    }
    throw err;
  }
}

// Map bbProxy action names + extras onto the direct Browserbase REST client
// in src/lib/browserbaseApi.js. Every action that can reach this dispatcher
// must have a case here: unknown actions throw so we notice at call time
// instead of silently going dark. To add a new action, implement the REST
// helper in browserbaseApi.js and add a case below.
/**
 * Dispatches a Browserbase action over the direct REST transport using provided API credentials.
 *
 * Calls the appropriate Browserbase REST helper based on `action` and returns that helper's result.
 * For deprecated endpoints the function may return a synthetic notice object instead of making a network call.
 *
 * @param {string} action - The Browserbase action to perform (e.g., 'listSessions', 'getSession', 'createSession', etc.).
 * @param {Object} extras - Action-specific payload (e.g., { sessionId }, { options }, { count }). The exact shape depends on `action`.
 * @param {{apiKey?: string, projectId?: string}} creds - Parsed credentials used for direct REST calls; `apiKey` is required for network requests and `projectId` may be attached when applicable.
 * @returns {any} The response returned by the Browserbase REST helper for the given action, or a synthetic object for deprecated endpoints.
 * @throws {Error} If `action` is not recognized by the direct dispatch mapping.
 */
async function callDirect(action, extras, creds, _opts = {}) {
  // _opts.signal is reserved for future AbortController threading through bb.* helpers
  const { apiKey, projectId } = creds;

  switch (action) {
    case 'listSessions':
      return bb.listSessions(apiKey, extras.status ?? null);
    case 'getSession':
      return bb.getSession(apiKey, extras.sessionId);
    case 'createSession': {
      // Ensure stored projectId is authoritative by deleting any caller-supplied override
      const options = { ...(extras.options ?? {}) };
      delete options.projectId;
      return bb.createSession(apiKey, {
        ...options,
        projectId,
      });
    }
    case 'updateSession': {
      // Mirror bbProxy semantics: BB docs say update session is POST (not
      // PUT), and bbClient.updateSession(sessionId) with no data is the
      // documented "release this session" shortcut — default to
      // REQUEST_RELEASE when the caller passed no data or an empty object.
      const updateData = extras.data;
      const hasData = updateData && typeof updateData === 'object' && Object.keys(updateData).length > 0;
      const payload = hasData
        ? { ...updateData }
        : { status: 'REQUEST_RELEASE' };
      if (projectId) payload.projectId = projectId;
      return bb.updateSession(apiKey, extras.sessionId, payload);
    }
    case 'getSessionLogs':
      return bb.getSessionLogs(apiKey, extras.sessionId);
    case 'getSessionDebug':
      return bb.getSessionDebug(apiKey, extras.sessionId);
    case 'getSessionRecording':
      // Mirror bbProxy: the Browserbase Session Recording REST endpoint is
      // deprecated, so return the same synthetic notice instead of making
      // a network call that's likely to fail. Keep this message in sync
      // with base44/functions/bbProxy/entry.ts.
      return {
        deprecated: true,
        message: 'The Browserbase Session Recording API has been deprecated. Contact support@browserbase.com for alternatives.',
      };
    case 'getProjectUsage':
      return bb.getProjectUsage(apiKey, projectId);
    case 'listContexts':
      return bb.listContexts(apiKey);
    case 'getContext':
      return bb.getContext(apiKey, extras.contextId);
    case 'createContext':
      return bb.createContext(apiKey, projectId);
    case 'deleteContext':
      return bb.deleteContext(apiKey, extras.contextId);
    case 'batchCreateSessions': {
      // Ensure stored projectId is authoritative by deleting any caller-supplied override
      const options = { ...(extras.options ?? {}) };
      delete options.projectId;
      return bb.batchCreateSessions(apiKey, extras.count, {
        ...options,
        projectId,
      });
    }
    default:
      // Unknown action — fail loudly so a new bbProxy case doesn't silently
      // lose the direct-dispatch benefit the next time someone adds one.
      throw new Error(`bbClient: direct path has no mapping for action "${action}"`);
  }
}

export function isLikelyApiKeyBbProxyFailure(err) {
  const status = err?.response?.status ?? err?.status;
  if (status === 404 || status === 405) return true;
  const msg = String(err?.message ?? '');
  return /\b(404|405)\b/.test(msg);
}

/**
 * call() wraps callOnce with auto-retry + exponential backoff + circuit breaker.
 * On network/5xx errors, retries up to maxRetries times before throwing.
 * Non-idempotent actions (createSession, createContext, batchCreateSessions,
 * updateSession) are not retried to avoid duplicate resource creation.
 *
 * Accepts an optional opts.signal (AbortSignal) for cancellation on unmount.
 */
async function call(action, extras = {}, { maxRetries = 3, signal } = {}) {
  // Circuit breaker — fast-fail if Browserbase has been failing repeatedly
  if (!circuit.canRequest()) {
    throw new CircuitOpenError();
  }

  // Non-idempotent actions should not be retried automatically
  const nonIdempotentActions = ['createSession', 'createContext', 'batchCreateSessions', 'updateSession'];
  const shouldRetry = !nonIdempotentActions.includes(action);

  let delay = 800;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await callOnce(action, extras, { signal });
      circuit.recordSuccess();
      return result;
    } catch (err) {
      // Don't trip the breaker on client-side aborts or auth/validation errors
      const status = err?.status;
      const isClientErr = status >= 400 && status < 500 && status !== 429;
      const isAbort = err?.name === 'AbortError';
      if (!isAbort && !isClientErr) circuit.recordFailure();
      if (isAbort) throw err;

      const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
      const retryableCodes = new Set(['BB_TIMEOUT', 'BB_NETWORK', 'BB_RATE_LIMITED', 'BB_SERVER']);
      const isRetryable = retryableStatuses.has(err?.status) ||
        retryableCodes.has(err?.code) ||
        /fetch|network|\b(500|502|503|504)\b/i.test(err?.message || '');
      if (!shouldRetry || !isRetryable || attempt === maxRetries) throw err;
      // #17 jittered backoff (±25%) to avoid thundering-herd
      const j = delay * 0.25;
      const wait = Math.max(0, delay + (Math.random() * 2 - 1) * j);
      await new Promise(r => setTimeout(r, wait));
      delay = Math.min(delay * 2, 8000);
    }
  }
}

// All public methods accept an optional opts = { signal } for cancellation.
export const bbClient = {
  // Sessions
  listSessions: (status = null, opts) => call('listSessions', status ? { status } : {}, opts),
  getSession: (sessionId, opts) => call('getSession', { sessionId }, opts),
  createSession: (options = {}, opts) => call('createSession', { options }, opts),
  updateSession: (sessionId, data, opts) => call('updateSession', { sessionId, data: data ?? {} }, opts),
  getSessionLogs: (sessionId, opts) => call('getSessionLogs', { sessionId }, opts),
  getSessionRecording: (sessionId, opts) => call('getSessionRecording', { sessionId }, opts),
  getSessionDebug: (sessionId, opts) => call('getSessionDebug', { sessionId }, opts),

  // Usage
  getProjectUsage: (opts) => call('getProjectUsage', {}, opts),

  // Contexts
  listContexts: (opts) => call('listContexts', {}, opts),
  getContext: (contextId, opts) => call('getContext', { contextId }, opts),
  createContext: (opts) => call('createContext', {}, opts),
  deleteContext: (contextId, opts) => call('deleteContext', { contextId }, opts),

  // Batch
  batchCreateSessions: (count, options = {}, opts) => call('batchCreateSessions', { count, options }, opts),

  // Diagnostics — tries every key source × header variant and reports
  // which combo works. Used by Settings → "Diagnose & Auto-Fix".
  diagnose: (opts) => call('diagnose', {}, opts),
};

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

/** Returns estimated cost in USD for a session given startedAt / endedAt */
export function estimateCost(startedAt, endedAt) {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const minutes = (end - start) / 60000;
  return minutes * BB_COST_PER_MINUTE;
}

export function formatCost(usd) {
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(3)}`;
}