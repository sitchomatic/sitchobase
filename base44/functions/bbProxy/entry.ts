/**
 * Browserbase API Proxy — solves CORS by proxying all BB API calls server-side.
 * All actions are dispatched via { action, ...params } in the request body.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';

function bbHeaders(apiKey) {
  return { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' };
}

async function bbFetch(path, method = 'GET', apiKey, body = null) {
  const opts = { method, headers: bbHeaders(apiKey) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BB_BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`BB API ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, apiKey, projectId, ...params } = await req.json();
    if (!apiKey) return Response.json({ error: 'apiKey required' }, { status: 400 });

    let result;

    switch (action) {

      // ── Sessions ──────────────────────────────────────────
      case 'listSessions': {
        const qs = params.status ? `?status=${params.status}` : '';
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
      case 'updateSession': {
        result = await bbFetch(`/sessions/${params.sessionId}`, 'PUT', apiKey, params.data);
        break;
      }
      case 'getSessionLogs': {
        result = await bbFetch(`/sessions/${params.sessionId}/logs`, 'GET', apiKey);
        break;
      }
      case 'getSessionRecording': {
        result = await bbFetch(`/sessions/${params.sessionId}/recording`, 'GET', apiKey);
        break;
      }

      // ── Usage ─────────────────────────────────────────────
      case 'getProjectUsage': {
        result = await bbFetch(`/projects/${projectId}/usage`, 'GET', apiKey);
        break;
      }

      // ── Contexts ──────────────────────────────────────────
      case 'listContexts': {
        result = await bbFetch('/contexts', 'GET', apiKey);
        break;
      }
      case 'createContext': {
        result = await bbFetch('/contexts', 'POST', apiKey, { projectId });
        break;
      }
      case 'deleteContext': {
        const res = await fetch(`${BB_BASE}/contexts/${params.contextId}`, {
          method: 'DELETE', headers: bbHeaders(apiKey)
        });
        result = res.status === 204 ? { ok: true } : await res.json();
        break;
      }

      // ── Batch create sessions ─────────────────────────────
      case 'batchCreateSessions': {
        const { count, options } = params;
        const results = [];
        const errors = [];
        let delay = 400;
        for (let i = 0; i < count; i++) {
          let done = false, attempts = 0;
          while (!done && attempts < 5) {
            try {
              const s = await bbFetch('/sessions', 'POST', apiKey, { projectId, ...options });
              results.push(s);
              done = true;
              delay = 400;
            } catch (err) {
              attempts++;
              if (err.message.includes('429')) {
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 2, 16000);
              } else {
                errors.push({ index: i, error: err.message });
                done = true;
              }
            }
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
    return Response.json({ error: err.message }, { status: 500 });
  }
});