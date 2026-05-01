/**
 * liveLook — unified backend proxy for the /live "Live Look-In" page.
 *
 * Why a single function (not three)?
 *   - All three providers need the user authenticated (base44.auth.me()).
 *   - All three need a server-side secret OR a per-request override so the
 *     user's key is never logged in the browser console / network panel.
 *   - One function = one place to add audit logging, rate limits, etc.
 *
 * Actions:
 *   { provider: 'browserbase', op: 'live',  sessionId }
 *     → GET https://api.browserbase.com/v1/sessions/{id}/debug
 *       Returns { debuggerUrl, debuggerFullscreenUrl, pages, wsUrl }.
 *
 *   { provider: 'browserless', op: 'live',  url, options? }
 *     → POST https://production-sfo.browserless.io/chromium/bql?token=...
 *       Runs the documented `liveURL` BrowserQL mutation. Returns { liveURL }.
 *
 *   { provider: 'scrapingbee', op: 'screenshot', url, fullPage?, premiumProxy? }
 *     → GET https://app.scrapingbee.com/api/v1?api_key=...&url=...&screenshot=true
 *       Returns the PNG as a base64 data URL so the browser can <img src=…>
 *       it directly without exposing the API key.
 *
 * Each provider also supports `op: 'ping'` which performs a tiny credential
 * check (no resources spent) so the UI can show a green/red status pill.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const BL_BASE = 'https://production-sfo.browserless.io';
const SB_BASE = 'https://app.scrapingbee.com/api/v1';

function json(body, status = 200) {
  return Response.json(body, { status });
}

// ── Browserbase ────────────────────────────────────────────────────────────
async function bbHeaders(apiKey) {
  return { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' };
}

async function bbLive(apiKey, sessionId) {
  const res = await fetch(`${BB_BASE}/sessions/${encodeURIComponent(sessionId)}/debug`, {
    headers: await bbHeaders(apiKey),
  });
  const text = await res.text();
  if (!res.ok) {
    return json({ ok: false, error: `Browserbase ${res.status}: ${text.slice(0, 300)}` }, 200);
  }
  let payload;
  try { payload = JSON.parse(text); } catch { payload = {}; }
  return json({ ok: true, data: payload });
}

async function bbPing(apiKey) {
  // Lightweight: list sessions with limit-ish call (BB has no /me).
  const res = await fetch(`${BB_BASE}/sessions?status=RUNNING`, {
    headers: await bbHeaders(apiKey),
  });
  if (res.ok) return json({ ok: true });
  const text = await res.text();
  return json({ ok: false, error: `Browserbase ${res.status}: ${text.slice(0, 200)}` }, 200);
}

// ── Browserless ────────────────────────────────────────────────────────────
async function blLive(token, url, opts = {}) {
  // BrowserQL mutation that goto()s the URL then mints a shareable liveURL.
  // Docs: https://docs.browserless.io/bql-schema/operations/mutations/live-url
  const interactable = opts.interactable !== false;
  const showBrowserInterface = opts.showBrowserInterface === true;
  const query = `mutation CreateLiveURL {
  goto(url: ${JSON.stringify(url)}, waitUntil: networkIdle) { status }
  liveURL(interactable: ${interactable}, showBrowserInterface: ${showBrowserInterface}) { liveURL }
}`;
  const res = await fetch(`${BL_BASE}/chromium/bql?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    return json({ ok: false, error: `Browserless ${res.status}: ${text.slice(0, 300)}` }, 200);
  }
  let body;
  try { body = JSON.parse(text); } catch { body = {}; }
  if (body.errors?.length) {
    return json({ ok: false, error: body.errors.map(e => e.message).join('; ') }, 200);
  }
  const liveURL = body?.data?.liveURL?.liveURL;
  if (!liveURL) return json({ ok: false, error: 'Browserless: no liveURL in response' }, 200);
  return json({ ok: true, data: { liveURL, gotoStatus: body?.data?.goto?.status ?? null } });
}

async function blPing(token) {
  // Minimal BQL introspection — confirms token + connectivity without
  // launching a browser. /pressure isn't available on all BQL endpoints.
  const res = await fetch(`${BL_BASE}/chromium/bql?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
  });
  const text = await res.text();
  if (!res.ok) {
    return json({ ok: false, error: `Browserless ${res.status}: ${text.slice(0, 200)}` }, 200);
  }
  let body;
  try { body = JSON.parse(text); } catch { body = {}; }
  if (body.errors?.length) {
    return json({ ok: false, error: body.errors.map(e => e.message).join('; ') }, 200);
  }
  return json({ ok: true });
}

// ── ScrapingBee ────────────────────────────────────────────────────────────
async function sbScreenshot(apiKey, targetUrl, { fullPage = false, premiumProxy = false } = {}) {
  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    render_js: 'true',
    [fullPage ? 'screenshot_full_page' : 'screenshot']: 'true',
  });
  if (premiumProxy) params.set('premium_proxy', 'true');
  const res = await fetch(`${SB_BASE}/?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, error: `ScrapingBee ${res.status}: ${text.slice(0, 300)}` }, 200);
  }
  const buf = await res.arrayBuffer();
  // Encode as base64 data URL so the frontend can drop it straight into <img>.
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const remaining = res.headers.get('spb-remaining-api-calls');
  return json({
    ok: true,
    data: {
      dataUrl: `data:image/png;base64,${base64}`,
      bytes: bytes.length,
      remainingCalls: remaining ? Number(remaining) : null,
    },
  });
}

async function sbPing(apiKey) {
  // Documented account endpoint — costs zero API credits.
  const res = await fetch(`${SB_BASE}/usage?api_key=${encodeURIComponent(apiKey)}`);
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return json({ ok: true, data });
  }
  const text = await res.text();
  return json({ ok: false, error: `ScrapingBee ${res.status}: ${text.slice(0, 200)}` }, 200);
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { provider, op, apiKeyOverride } = body || {};
    if (!provider || !op) return json({ ok: false, error: 'provider and op are required' }, 400);

    if (provider === 'browserbase') {
      const apiKey = apiKeyOverride || Deno.env.get('Api_key');
      if (!apiKey) return json({ ok: false, error: 'No Browserbase API key configured' }, 200);
      if (op === 'ping') return bbPing(apiKey);
      if (op === 'live') {
        if (!body.sessionId) return json({ ok: false, error: 'sessionId required' }, 400);
        return bbLive(apiKey, body.sessionId);
      }
      return json({ ok: false, error: `Unknown op for browserbase: ${op}` }, 400);
    }

    if (provider === 'browserless') {
      const token = apiKeyOverride || Deno.env.get('BROWSERLESS_API_KEY');
      if (!token) return json({ ok: false, error: 'BROWSERLESS_API_KEY not configured' }, 200);
      if (op === 'ping') return blPing(token);
      if (op === 'live') {
        if (!body.url) return json({ ok: false, error: 'url required' }, 400);
        return blLive(token, body.url, body.options || {});
      }
      return json({ ok: false, error: `Unknown op for browserless: ${op}` }, 400);
    }

    if (provider === 'scrapingbee') {
      const apiKey = apiKeyOverride || Deno.env.get('SCRAPINGBEE_API_KEY');
      if (!apiKey) return json({ ok: false, error: 'SCRAPINGBEE_API_KEY not configured' }, 200);
      if (op === 'ping') return sbPing(apiKey);
      if (op === 'screenshot') {
        if (!body.url) return json({ ok: false, error: 'url required' }, 400);
        return sbScreenshot(apiKey, body.url, {
          fullPage: !!body.fullPage,
          premiumProxy: !!body.premiumProxy,
        });
      }
      return json({ ok: false, error: `Unknown op for scrapingbee: ${op}` }, 400);
    }

    return json({ ok: false, error: `Unknown provider: ${provider}` }, 400);
  } catch (err) {
    return json({ ok: false, error: err?.message || 'liveLook crashed' }, 500);
  }
});