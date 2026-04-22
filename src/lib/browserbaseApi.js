// In Vite dev builds we go through a local proxy (see vite.config.js) so the
// browser can hit the Browserbase REST API despite its lack of CORS. In any
// other runtime (prod build, Node tests) we fall back to the real host, which
// the bbClient dispatcher will only reach after deciding it is safe to do so.
const BB_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/bb/v1'
    : 'https://api.browserbase.com/v1';

function getHeaders(apiKey) {
  return {
    'X-BB-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

export async function listSessions(apiKey, status = null) {
  // Build the query string manually so `BB_BASE_URL` can be either an absolute
  // URL (prod / Node) or a root-relative path (Vite dev proxy). `new URL(path)`
  // with a single argument requires an absolute URL and throws otherwise.
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${BB_BASE_URL}/sessions${qs}`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`List sessions failed: ${res.status}`);
  return res.json();
}

export async function getSession(apiKey, sessionId) {
  const res = await fetch(`${BB_BASE_URL}/sessions/${sessionId}`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get session failed: ${res.status}`);
  return res.json();
}

export async function createSession(apiKey, options = {}) {
  const res = await fetch(`${BB_BASE_URL}/sessions`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create session failed: ${res.status} - ${err}`);
  }
  return res.json();
}

export async function updateSession(apiKey, sessionId, data) {
  // BB docs: update session uses POST (not PUT). bbProxy mirrors this.
  const res = await fetch(`${BB_BASE_URL}/sessions/${sessionId}`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update session failed: ${res.status}`);
  return res.json();
}

/**
 * Fetches the logs for a given session.
 * @param {string} apiKey - Browserbase API key used for authentication.
 * @param {string} sessionId - ID of the session to retrieve logs for.
 * @returns {any} The parsed JSON response containing the session logs.
 * @throws {Error} If the HTTP response is not OK; the error message includes the response status code.
 */
export async function getSessionLogs(apiKey, sessionId) {
  const res = await fetch(`${BB_BASE_URL}/sessions/${sessionId}/logs`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get logs failed: ${res.status}`);
  return res.json();
}

// Browserbase exposes live CDP + debugger URLs for a RUNNING session at
// GET /v1/sessions/{id}/debug. listSessions does NOT return these, so the
// Monitor has to hydrate each running session with its own debug payload:
//   { wsUrl, debuggerUrl, debuggerFullscreenUrl, pages: [...] }
// wsUrl is the browser-level CDP WebSocket the live-screenshot panels talk to;
/**
 * Fetches debug information for a session, including embeddable debugger URL and page details.
 * @param {string} apiKey - Browserbase API key used for authentication.
 * @param {string} sessionId - ID of the session to retrieve debug info for.
 * @returns {Object} The session debug payload containing live CDP/debug URLs, the embeddable live-view iframe URL, and page details.
 * @throws {Error} If the HTTP response status is not OK.
 */
export async function getSessionDebug(apiKey, sessionId) {
  const res = await fetch(`${BB_BASE_URL}/sessions/${sessionId}/debug`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get session debug failed: ${res.status}`);
  return res.json();
}

/**
 * Fetches recording metadata for a session.
 * @param {string} apiKey - Browserbase API key used for authentication.
 * @param {string} sessionId - ID of the session whose recording to retrieve.
 * @returns {Object} The recording metadata as parsed JSON.
 * @throws {Error} If the HTTP response is not OK; the error message includes the response status code.
 */
export async function getSessionRecording(apiKey, sessionId) {
  const res = await fetch(`${BB_BASE_URL}/sessions/${sessionId}/recording`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get recording failed: ${res.status}`);
  return res.json();
}

export async function getProjectUsage(apiKey, projectId) {
  const res = await fetch(`${BB_BASE_URL}/projects/${projectId}/usage`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get usage failed: ${res.status}`);
  return res.json();
}

export async function listContexts(apiKey) {
  const res = await fetch(`${BB_BASE_URL}/contexts`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`List contexts failed: ${res.status}`);
  return res.json();
}

export async function getContext(apiKey, contextId) {
  const res = await fetch(`${BB_BASE_URL}/contexts/${contextId}`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Get context failed: ${res.status}`);
  return res.json();
}

export async function createContext(apiKey, projectId) {
  const res = await fetch(`${BB_BASE_URL}/contexts`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error(`Create context failed: ${res.status}`);
  return res.json();
}

export async function deleteContext(apiKey, contextId) {
  const res = await fetch(`${BB_BASE_URL}/contexts/${contextId}`, {
    method: 'DELETE',
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Delete context failed: ${res.status}`);
  return res.status === 204 ? {} : res.json();
}

// Batch create sessions with exponential backoff on 429
export async function batchCreateSessions(apiKey, count, options = {}, onProgress) {
  const results = [];
  const errors = [];
  const MAX_ATTEMPTS = 5;
  let delay = 500;

  for (let i = 0; i < count; i++) {
    let success = false;
    let attempts = 0;
    let lastErr = null;
    while (!success && attempts < MAX_ATTEMPTS) {
      try {
        const session = await createSession(apiKey, options);
        results.push(session);
        if (onProgress) onProgress(i + 1, count, session);
        success = true;
        delay = 500; // reset on success
      } catch (err) {
        attempts++;
        lastErr = err;
        if (err.message.includes('429')) {
          await new Promise(r => setTimeout(r, delay));
          delay = Math.min(delay * 2, 16000);
        } else {
          errors.push({ index: i, error: err.message });
          success = true; // move on
        }
      }
    }
    // Record the failure if 429 retries were exhausted without success so the
    // caller doesn't silently end up with fewer sessions than requested.
    if (!success) {
      errors.push({ index: i, error: lastErr?.message || `Failed after ${MAX_ATTEMPTS} attempts` });
    }
    // small gap between requests
    if (i < count - 1) await new Promise(r => setTimeout(r, 200));
  }

  return { results, errors };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
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