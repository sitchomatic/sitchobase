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

      // ── Session CDP commands (mouse, keyboard, screenshot) ─
      case 'sendCommand': {
        // Uses Browserbase session's debug URL to send CDP commands
        const { sessionId, command, commandParams } = params;
        // Get session to retrieve debugger URL
        const session = await bbFetch(`/sessions/${sessionId}`, 'GET', apiKey);
        if (!session.debuggerUrl) {
          // Fall back to userMetadata command broadcast
          result = await bbFetch(`/sessions/${sessionId}`, 'PUT', apiKey, {
            userMetadata: { remoteCommand: JSON.stringify({ command, params: commandParams, ts: Date.now() }) }
          });
          result = { ok: true, method: 'metadata', command };
          break;
        }
        // Connect to CDP via debugger websocket endpoint
        const debugUrl = session.debuggerUrl;
        // Use the /json endpoint to get the websocket debugger URL
        const jsonUrl = debugUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        let cdpResult = null;
        try {
          const jsonResp = await fetch(`${jsonUrl}/json`);
          const targets = await jsonResp.json();
          const pageTarget = targets.find(t => t.type === 'page') || targets[0];
          if (pageTarget?.webSocketDebuggerUrl) {
            // CDP WebSocket - we'll use HTTP POST endpoint if available, otherwise metadata
            cdpResult = { ok: true, debuggerUrl: pageTarget.webSocketDebuggerUrl };
          }
        } catch {
          // If CDP not reachable, use metadata broadcast
        }
        // Store command in session metadata so client can process it
        result = await bbFetch(`/sessions/${sessionId}`, 'PUT', apiKey, {
          userMetadata: { remoteCommand: JSON.stringify({ command, params: commandParams, ts: Date.now() }) }
        });
        result = { ok: true, command, cdpInfo: cdpResult };
        break;
      }

      case 'captureScreenshot': {
        // Takes a screenshot by updating session metadata with a screenshot request
        // and returns any previously stored screenshot URL from metadata
        const { sessionId } = params;
        const session = await bbFetch(`/sessions/${sessionId}`, 'GET', apiKey);
        const existing = session.userMetadata?.lastScreenshotUrl || null;
        // Trigger a screenshot command via metadata
        await bbFetch(`/sessions/${sessionId}`, 'PUT', apiKey, {
          userMetadata: {
            ...session.userMetadata,
            screenshotRequested: Date.now(),
            remoteCommand: JSON.stringify({ command: 'screenshot', ts: Date.now() })
          }
        });
        result = { ok: true, sessionId, screenshotUrl: existing };
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