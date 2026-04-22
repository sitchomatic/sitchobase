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

// Cost constants (Browserbase pricing — update if pricing changes)
export const BB_COST_PER_MINUTE = 0.009; // USD per browser minute

// True when the Base44 SDK is authenticated via an `api_key` header (local dev
// shortcut) instead of an interactive user session. Exposed for UIs that want
// to branch on auth mode.
export const isUsingApiKeyAuth = () => Boolean(import.meta.env.VITE_BASE44_API_KEY);

function readStoredCredentials() {
  try {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('bb_credentials')
      : null;
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Coerce non-plain-object results (null, arrays, scalars) to {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    // Trim whitespace from relevant string fields
    const result = { ...parsed };
    if (typeof result.apiKey === 'string') {
      result.apiKey = result.apiKey.trim();
    }
    if (typeof result.projectId === 'string') {
      result.projectId = result.projectId.trim();
    }
    return result;
  } catch {
    return {};
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

async function callOnce(action, extras = {}) {
  const creds = readStoredCredentials();
  if (canUseDirectBrowserbase(creds)) {
    return callDirect(action, extras, creds);
  }
  const payload = { action, ...extras };
  if (creds.projectId) payload.projectId = creds.projectId;
  try {
    const res = await base44.functions.invoke('bbProxy', payload);
    return res.data.data;
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
async function callDirect(action, extras, creds) {
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
 * call() wraps callOnce with auto-retry + exponential backoff.
 * On network/5xx errors, retries up to maxRetries times before throwing.
 * Non-idempotent actions (createSession, createContext, batchCreateSessions,
 * updateSession) are not retried to avoid duplicate resource creation.
 */
async function call(action, extras = {}, maxRetries = 3) {
  // Non-idempotent actions should not be retried automatically
  const nonIdempotentActions = ['createSession', 'createContext', 'batchCreateSessions', 'updateSession'];
  const shouldRetry = !nonIdempotentActions.includes(action);

  let delay = 800;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callOnce(action, extras);
    } catch (err) {
      const isRetryable = err.message?.includes('fetch') ||
        err.message?.includes('network') ||
        err.message?.includes('500') ||
        err.message?.includes('502') ||
        err.message?.includes('503') ||
        err.message?.includes('504');
      if (!shouldRetry || !isRetryable || attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 8000);
    }
  }
}

export const bbClient = {
  // Sessions
  listSessions: (status = null) => call('listSessions', status ? { status } : {}),
  getSession: (sessionId) => call('getSession', { sessionId }),
  createSession: (options = {}) => call('createSession', { options }),
  updateSession: (sessionId, data) => call('updateSession', { sessionId, data: data ?? {} }),
  getSessionLogs: (sessionId) => call('getSessionLogs', { sessionId }),
  getSessionRecording: (sessionId) => call('getSessionRecording', { sessionId }),

  // Usage
  getProjectUsage: () => call('getProjectUsage'),

  // Contexts
  listContexts: () => call('listContexts'),
  getContext: (contextId) => call('getContext', { contextId }),
  createContext: () => call('createContext'),
  deleteContext: (contextId) => call('deleteContext', { contextId }),

  // Batch
  batchCreateSessions: (count, options = {}) => call('batchCreateSessions', { count, options }),

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