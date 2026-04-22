/**
 * Frontend client for the bbProxy backend function.
 * All Browserbase API calls go through here — no more CORS issues.
 */
import { base44 } from '@/api/base44Client';

// Cost constants (Browserbase pricing — update if pricing changes)
export const BB_COST_PER_MINUTE = 0.009; // USD per browser minute

// True when the Base44 SDK is authenticated via an `api_key` header (local dev
// shortcut) instead of an interactive user session. Exposed for UIs that want
// to explain why bbProxy-backed features fail under this auth mode.
export const isUsingApiKeyAuth = () => Boolean(import.meta.env.VITE_BASE44_API_KEY);

// The bbProxy Base44 function does not accept `api_key` header auth — it
// requires a real user session and returns 404/405 under api_key mode. This
// message is rendered by UI surfaces that invoke bbProxy.
export const API_KEY_BBPROXY_MESSAGE =
  'This action uses the bbProxy Base44 function, which only works with an ' +
  'interactive Google login — not the local VITE_BASE44_API_KEY. Unset ' +
  'VITE_BASE44_API_KEY and sign in via Base44 to use it.';

async function callOnce(action, extras = {}) {
  const stored = localStorage.getItem('bb_credentials');
  const creds = stored ? JSON.parse(stored) : {};
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

function isLikelyApiKeyBbProxyFailure(err) {
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