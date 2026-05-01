/**
 * liveLook — unified backend proxy for Browser Monitoring (Browserbase,
 * Browserless, ScrapingBee). Every request is wrapped in a structured log
 * envelope and returned to the caller as `_log`, so the frontend can push
 * it into a unified log buffer for export / debugging.
 *
 * Log envelope shape (always present, even on success):
 *   _log: {
 *     request_id, provider, op, started_at, duration_ms,
 *     upstream_status, ok, error_kind?, error_summary?, hint?
 *   }
 *
 * No secrets are ever returned in `_log`.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const BL_BASE = 'https://production-sfo.browserless.io';
const SB_BASE = 'https://app.scrapingbee.com/api/v1';

function newRequestId() {
  return `ll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Classify upstream errors so the UI can render a meaningful hint without
// re-parsing strings on the client.
function classifyError(status, text) {
  if (status === 401 || status === 403) return { kind: 'auth', hint: 'Invalid or missing API credentials' };
  if (status === 402) return { kind: 'billing', hint: 'Plan limit reached or feature not on current plan' };
  if (status === 404) return { kind: 'not_found', hint: 'Resource not found — session may have ended or ID is wrong' };
  if (status === 408 || status === 504) return { kind: 'timeout', hint: 'Upstream timed out' };
  if (status === 429) return { kind: 'rate_limit', hint: 'Rate-limited by provider — back off and retry' };
  if (status >= 500) return { kind: 'upstream_5xx', hint: 'Provider is having issues' };
  if (status >= 400) return { kind: 'bad_request', hint: 'Provider rejected the request' };
  if (/ENOTFOUND|ECONNRESET|fetch failed/i.test(text || '')) return { kind: 'network', hint: 'Could not reach the provider' };
  return { kind: 'unknown', hint: 'Unexpected upstream response' };
}

function ok(data, log) {
  return Response.json({ ok: true, data, _log: { ...log, ok: true } });
}

function fail(status, error, log, extra = {}) {
  const cls = classifyError(log.upstream_status ?? 0, error);
  return Response.json(
    {
      ok: false,
      error,
      _log: { ...log, ok: false, error_kind: cls.kind, error_summary: error?.slice(0, 300), hint: cls.hint, ...extra },
    },
    { status: 200 }
  );
}

// ── Browserbase ────────────────────────────────────────────────────────────
function bbHeaders(apiKey) {
  return { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' };
}

async function bbLive(apiKey, sessionId, log) {
  const res = await fetch(`${BB_BASE}/sessions/${encodeURIComponent(sessionId)}/debug`, { headers: bbHeaders(apiKey) });
  log.upstream_status = res.status;
  const text = await res.text();
  if (!res.ok) return fail(200, `Browserbase ${res.status}: ${text.slice(0, 300)}`, log);
  let payload; try { payload = JSON.parse(text); } catch { payload = {}; }
  return ok(payload, log);
}

async function bbPing(apiKey, log) {
  const res = await fetch(`${BB_BASE}/sessions?status=RUNNING`, { headers: bbHeaders(apiKey) });
  log.upstream_status = res.status;
  if (res.ok) {
    const text = await res.text();
    let arr = []; try { arr = JSON.parse(text); } catch {}
    return ok({ runningSessions: Array.isArray(arr) ? arr.length : 0 }, log);
  }
  const text = await res.text();
  return fail(200, `Browserbase ${res.status}: ${text.slice(0, 200)}`, log);
}

async function bbRecording(apiKey, sessionId, log) {
  const res = await fetch(`${BB_BASE}/sessions/${encodeURIComponent(sessionId)}/recording`, { headers: bbHeaders(apiKey) });
  log.upstream_status = res.status;
  const text = await res.text();
  if (!res.ok) return fail(200, `Browserbase ${res.status}: ${text.slice(0, 300)}`, log);
  let events; try { events = JSON.parse(text); } catch { events = []; }
  const arr = Array.isArray(events) ? events : (events?.events || []);
  return ok({
    eventCount: arr.length,
    firstTimestamp: arr[0]?.timestamp ?? null,
    lastTimestamp: arr[arr.length - 1]?.timestamp ?? null,
    sample: arr.slice(0, 3),
  }, log);
}

// ── Browserless ────────────────────────────────────────────────────────────
async function blLive(token, url, opts = {}, log) {
  const interactable = opts.interactable !== false;
  const showBrowserInterface = opts.showBrowserInterface === true;
  const query = `mutation CreateLiveURL {
  goto(url: ${JSON.stringify(url)}, waitUntil: networkIdle) { status }
  liveURL(interactable: ${interactable}, showBrowserInterface: ${showBrowserInterface}) { liveURL }
}`;
  const res = await fetch(`${BL_BASE}/chromium/bql?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  log.upstream_status = res.status;
  const text = await res.text();
  if (!res.ok) return fail(200, `Browserless ${res.status}: ${text.slice(0, 300)}`, log);
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  if (body.errors?.length) return fail(200, body.errors.map(e => e.message).join('; '), log);
  const liveURL = body?.data?.liveURL?.liveURL;
  if (!liveURL) return fail(200, 'Browserless: no liveURL in response', log);
  return ok({ liveURL, gotoStatus: body?.data?.goto?.status ?? null }, log);
}

async function blScreenshot(token, targetUrl, { fullPage = false } = {}, log) {
  const res = await fetch(`${BL_BASE}/screenshot?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, options: { fullPage, type: 'png' } }),
  });
  log.upstream_status = res.status;
  if (!res.ok) {
    const text = await res.text();
    return fail(200, `Browserless ${res.status}: ${text.slice(0, 300)}`, log);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return ok({ dataUrl: `data:image/png;base64,${btoa(binary)}`, bytes: bytes.length }, log);
}

async function blPing(token, log) {
  const res = await fetch(`${BL_BASE}/chromium/bql?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
  });
  log.upstream_status = res.status;
  const text = await res.text();
  if (!res.ok) return fail(200, `Browserless ${res.status}: ${text.slice(0, 200)}`, log);
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  if (body.errors?.length) return fail(200, body.errors.map(e => e.message).join('; '), log);
  return ok({ typename: body?.data?.__typename || null }, log);
}

// ── ScrapingBee ────────────────────────────────────────────────────────────
async function sbScreenshot(apiKey, targetUrl, { fullPage = false, premiumProxy = false } = {}, log) {
  const params = new URLSearchParams({
    api_key: apiKey, url: targetUrl, render_js: 'true',
    [fullPage ? 'screenshot_full_page' : 'screenshot']: 'true',
  });
  if (premiumProxy) params.set('premium_proxy', 'true');
  const res = await fetch(`${SB_BASE}/?${params.toString()}`);
  log.upstream_status = res.status;
  if (!res.ok) {
    const text = await res.text();
    return fail(200, `ScrapingBee ${res.status}: ${text.slice(0, 300)}`, log);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const remaining = res.headers.get('spb-remaining-api-calls');
  return ok({
    dataUrl: `data:image/png;base64,${btoa(binary)}`,
    bytes: bytes.length,
    remainingCalls: remaining ? Number(remaining) : null,
  }, log);
}

async function sbPing(apiKey, log) {
  const res = await fetch(`${SB_BASE}/usage?api_key=${encodeURIComponent(apiKey)}`);
  log.upstream_status = res.status;
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return ok(data, log);
  }
  const text = await res.text();
  return fail(200, `ScrapingBee ${res.status}: ${text.slice(0, 200)}`, log);
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'POST only' }, { status: 405 });

  const log = {
    request_id: newRequestId(),
    provider: null,
    op: null,
    started_at: new Date().toISOString(),
    duration_ms: 0,
    upstream_status: null,
  };
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      log.duration_ms = Date.now() - t0;
      return Response.json({ ok: false, error: 'Unauthorized', _log: { ...log, ok: false, error_kind: 'auth', hint: 'Sign in required' } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { provider, op, apiKeyOverride } = body || {};
    log.provider = provider || null;
    log.op = op || null;

    if (!provider || !op) {
      log.duration_ms = Date.now() - t0;
      return fail(200, 'provider and op are required', log);
    }

    let response;
    if (provider === 'browserbase') {
      const apiKey = apiKeyOverride || Deno.env.get('Api_key');
      if (!apiKey) { log.duration_ms = Date.now() - t0; return fail(200, 'No Browserbase API key configured', log); }
      if (op === 'ping')      response = await bbPing(apiKey, log);
      else if (op === 'live') {
        if (!body.sessionId) { log.duration_ms = Date.now() - t0; return fail(200, 'sessionId required', log); }
        response = await bbLive(apiKey, body.sessionId, log);
      } else if (op === 'recording') {
        if (!body.sessionId) { log.duration_ms = Date.now() - t0; return fail(200, 'sessionId required', log); }
        response = await bbRecording(apiKey, body.sessionId, log);
      } else { log.duration_ms = Date.now() - t0; return fail(200, `Unknown op for browserbase: ${op}`, log); }
    } else if (provider === 'browserless') {
      const token = apiKeyOverride || Deno.env.get('BROWSERLESS_API_KEY');
      if (!token) { log.duration_ms = Date.now() - t0; return fail(200, 'BROWSERLESS_API_KEY not configured', log); }
      if (op === 'ping')      response = await blPing(token, log);
      else if (op === 'live') {
        if (!body.url) { log.duration_ms = Date.now() - t0; return fail(200, 'url required', log); }
        response = await blLive(token, body.url, body.options || {}, log);
      } else if (op === 'screenshot') {
        if (!body.url) { log.duration_ms = Date.now() - t0; return fail(200, 'url required', log); }
        response = await blScreenshot(token, body.url, { fullPage: !!body.fullPage }, log);
      } else { log.duration_ms = Date.now() - t0; return fail(200, `Unknown op for browserless: ${op}`, log); }
    } else if (provider === 'scrapingbee') {
      const apiKey = apiKeyOverride || Deno.env.get('SCRAPINGBEE_API_KEY');
      if (!apiKey) { log.duration_ms = Date.now() - t0; return fail(200, 'SCRAPINGBEE_API_KEY not configured', log); }
      if (op === 'ping')             response = await sbPing(apiKey, log);
      else if (op === 'screenshot') {
        if (!body.url) { log.duration_ms = Date.now() - t0; return fail(200, 'url required', log); }
        response = await sbScreenshot(apiKey, body.url, { fullPage: !!body.fullPage, premiumProxy: !!body.premiumProxy }, log);
      } else { log.duration_ms = Date.now() - t0; return fail(200, `Unknown op for scrapingbee: ${op}`, log); }
    } else {
      log.duration_ms = Date.now() - t0;
      return fail(200, `Unknown provider: ${provider}`, log);
    }

    // Stamp duration_ms onto the response body without re-parsing the
    // already-encoded base64 payload twice.
    const json = await response.json();
    json._log = { ...(json._log || log), duration_ms: Date.now() - t0 };
    return Response.json(json);
  } catch (err) {
    log.duration_ms = Date.now() - t0;
    const msg = err?.message || 'liveLook crashed';
    return Response.json(
      { ok: false, error: msg, _log: { ...log, ok: false, error_kind: 'crash', error_summary: msg.slice(0, 300), hint: 'Backend crashed — see Activity log' } },
      { status: 500 }
    );
  }
});