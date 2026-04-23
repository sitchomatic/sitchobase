/**
 * Browserbase API Proxy — solves CORS by proxying all BB API calls server-side.
 * All actions are dispatched via { action, ...params } in the request body.
 * API key is read from the server-side secret (Api_key); client-supplied key is
 * accepted as a fallback for backwards compatibility (Settings page test flow).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';

function bbHeaders(apiKey) {
  return { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' };
}

async function bbFetch(path, method = 'GET', apiKey, body = null) {
  const opts = { method, headers: bbHeaders(apiKey) };
  if (body) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(`${BB_BASE}${path}`, opts);
  } catch (err) {
    const e = new Error(`Network error calling Browserbase: ${err.message}`);
    e.status = 502;
    throw e;
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === 'object' ? (data.message || JSON.stringify(data)) : data;
    const e = new Error(`Browserbase ${res.status} on ${method} ${path}: ${detail}`);
    e.status = res.status;
    e.bbResponse = data;
    throw e;
  }
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, projectId, ...params } = body;

    // Strictly use the server-side secret — no client fallback
    const apiKey = Deno.env.get('Api_key');
    if (!apiKey) return Response.json({ error: 'Server misconfiguration: Api_key secret is not set' }, { status: 500 });

    let result;

    switch (action) {

      // ── Sessions ──────────────────────────────────────────
      case 'listSessions': {
        const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
        result = await bbFetch(`/sessions${qs}`, 'GET', apiKey);
        break;
      }

      case 'getSession': {
        result = await bbFetch(`/sessions/${params.sessionId}`, 'GET', apiKey);
        break;
      }

      case 'createSession': {
        result = await bbFetch('/sessions', 'POST', apiKey, { projectId, ...params.options });
        break;
      }

      // BB docs: update session uses POST (not PUT).
      // If caller passes data.userMetadata we send that; otherwise default to REQUEST_RELEASE (stop session).
      case 'updateSession': {
        const { sessionId, data: updateData } = params;
        let payload;
        if (updateData?.userMetadata) {
          // Mirror Mode / metadata broadcast — send userMetadata to BB
          payload = { userMetadata: updateData.userMetadata };
          if (projectId) payload.projectId = projectId;
        } else {
          // Default: stop/release the session
          payload = { status: 'REQUEST_RELEASE' };
          if (projectId) payload.projectId = projectId;
        }
        result = await bbFetch(`/sessions/${sessionId}`, 'POST', apiKey, payload);
        break;
      }

      case 'getSessionLogs': {
        result = await bbFetch(`/sessions/${params.sessionId}/logs`, 'GET', apiKey);
        break;
      }

      // Live CDP endpoint — returns { wsUrl, debuggerUrl, debuggerFullscreenUrl, pages }
      // so the Monitor can open a live-view iframe and drive CDP against a
      // RUNNING session. listSessions does not include any of these fields.
      case 'getSessionDebug': {
        result = await bbFetch(`/sessions/${params.sessionId}/debug`, 'GET', apiKey);
        break;
      }

      // Recording API deprecated by BB — return graceful notice
      case 'getSessionRecording': {
        result = { deprecated: true, message: 'The Browserbase Session Recording API has been deprecated. Contact support@browserbase.com for alternatives.' };
        break;
      }

      // ── Usage ─────────────────────────────────────────────
      case 'getProjectUsage': {
        if (!projectId) return Response.json({ error: 'projectId required for getProjectUsage' }, { status: 400 });
        result = await bbFetch(`/projects/${projectId}/usage`, 'GET', apiKey);
        break;
      }

      // ── Contexts ──────────────────────────────────────────
      // BB has no listContexts endpoint — GET by ID only
      case 'listContexts': {
        result = { items: [], note: 'Browserbase does not provide a list-all-contexts endpoint. Contexts are retrieved by ID.' };
        break;
      }

      case 'getContext': {
        result = await bbFetch(`/contexts/${params.contextId}`, 'GET', apiKey);
        break;
      }

      case 'createContext': {
        result = await bbFetch('/contexts', 'POST', apiKey, { projectId });
        break;
      }

      case 'deleteContext': {
        const res = await fetch(`${BB_BASE}/contexts/${params.contextId}`, {
          method: 'DELETE', headers: bbHeaders(apiKey),
        });
        result = res.status === 204 ? { ok: true } : await res.json();
        break;
      }

      // sendCommand / captureScreenshot are handled directly via CDP WebSocket
      // in the frontend (SessionCDPPanel) — the proxy does not implement them.

      // ── Batch create sessions ─────────────────────────────
      case 'batchCreateSessions': {
        const { count, options } = params;
        const results = [];
        const errors = [];
        const MAX_ATTEMPTS = 5;
        let delay = 400;
        for (let i = 0; i < count; i++) {
          let done = false, attempts = 0, lastErr = null;
          while (!done && attempts < MAX_ATTEMPTS) {
            try {
              const s = await bbFetch('/sessions', 'POST', apiKey, { projectId, ...options });
              results.push(s);
              done = true;
              delay = 400;
            } catch (err) {
              attempts++;
              lastErr = err;
              if (err.message.includes('429')) {
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 2, 16000);
              } else {
                errors.push({ index: i, error: err.message });
                done = true;
              }
            }
          }
          // Record the failure if 429 retries were exhausted without success so
          // the caller doesn't silently end up with fewer sessions than requested.
          if (!done) {
            errors.push({ index: i, error: lastErr?.message || `Failed after ${MAX_ATTEMPTS} attempts` });
          }
          if (i < count - 1) await new Promise(r => setTimeout(r, 150));
        }
        result = { results, errors };
        break;
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json({ data: result });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return Response.json({
      error: err.message,
      status,
      details: err.bbResponse ?? null,
    }, { status });
  }
});