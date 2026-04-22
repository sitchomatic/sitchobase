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
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// True when we can — and should — talk to Browserbase directly from the
// browser instead of routing through bbProxy. Requires: api_key auth mode
// (so bbProxy would fail anyway), a running Vite dev server (for the /bb
// CORS proxy), and a stored Browserbase API key. Exposed so UIs can skip
// the old "bbProxy doesn't support api_key" limitation banner when the
// direct path will actually succeed.
export function canUseDirectBrowserbase() {
  if (!isUsingApiKeyAuth()) return false;
  // import.meta.env.DEV is only true under `vite` / `vite build --mode development`.
  // Production builds must continue to go through bbProxy.
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return false;
  const { apiKey } = readStoredCredentials();
  return Boolean(apiKey);
}

// Kept for external callers — bbProxy-only limitation UX in surfaces where
// the direct path cannot help.
export const API_KEY_BBPROXY_MESSAGE =
  'This action uses the bbProxy Base44 function, which only works with an ' +
  'interactive Google login — not the local VITE_BASE44_API_KEY. Unset ' +
  'VITE_BASE44_API_KEY and sign in via Base44 to use it.';

async function callOnce(action, extras = {}) {
  const creds = readStoredCredentials();
  if (canUseDirectBrowserbase()) {
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
// in src/lib/browserbaseApi.js. Anything that isn't implemented directly
// falls back to bbProxy by returning undefined — callOnce re-dispatches.
async function callDirect(action, extras, creds) {
  const { apiKey, projectId } = creds;
  switch (action) {
    case 'listSessions':
      return bb.listSessions(apiKey, extras.status ?? null);
    case 'getSession':
      return bb.getSession(apiKey, extras.sessionId);
    case 'createSession':
      return bb.createSession(apiKey, {
        projectId,
        ...(extras.options ?? {}),
      });
    case 'updateSession':
      return bb.updateSession(apiKey, extras.sessionId, extras.data ?? {});
    case 'getSessionLogs':
      return bb.getSessionLogs(apiKey, extras.sessionId);
    case 'getSessionRecording':
      return bb.getSessionRecording(apiKey, extras.sessionId);
    case 'getProjectUsage':
      return bb.getProjectUsage(apiKey, projectId);
    case 'listContexts':
      return bb.listContexts(apiKey);
    case 'createContext':
      return bb.createContext(apiKey, projectId);
    case 'deleteContext':
      return bb.deleteContext(apiKey, extras.contextId);
    case 'batchCreateSessions':
      return bb.batchCreateSessions(apiKey, extras.count, {
        projectId,
        ...(extras.options ?? {}),
      });
    default:
      // Unknown action — fall through to bbProxy so future additions keep working.
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
 */
async function call(action, extras = {}, maxRetries = 3) {
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
      if (!isRetryable || attempt === maxRetries) throw err;
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