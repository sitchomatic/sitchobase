/**
 * casinoCredentialValidator — runs a real headless login against
 * Joe Fortune or Ignition using the AU mobile fingerprint + AU residential
 * proxy preset, and classifies the outcome (valid / invalid / locked / error).
 *
 * Reuses the same CDP helpers and outcome classifier as the Authorized Bulk QA
 * runner so the rotation flow inherits the same battle-tested form-fill,
 * settle, and "what page did we land on" logic. The only piece specific to
 * this module is the per-site selector map below.
 */
import { bbClient } from '@/lib/bbClient';
import {
  connectCdp, createAbortSignal, evaluate, wait, waitForPageIdle,
} from '@/lib/authorizedBulkCdp';
import { classifyAuthorizedBulkOutcome } from '@/lib/authorizedBulkOutcome';
import { JOE_FORTUNE, IGNITION, buildAuCasinoSessionOptions } from '@/lib/auCasino';

const SELECTOR_TIMEOUT_MS = 15_000;
const POST_SUBMIT_SETTLE_MS = 4_000;
const SESSION_TIMEOUT_SECONDS = 90;

// Per-site DOM selectors. Joe Fortune and Ignition share the Bovada stack so
// the same selectors work on both AU mobile views, but we keep them per-site
// in case one site re-skins independently.
const SITE_CONFIG = {
  [JOE_FORTUNE.key]: {
    target: JOE_FORTUNE,
    usernameSelector: 'input[name="email"], input[type="email"], input#email',
    passwordSelector: 'input[name="password"], input[type="password"], input#password',
    submitSelector: 'button[type="submit"], button[data-test-id*="login"], button[data-qa*="login"]',
  },
  [IGNITION.key]: {
    target: IGNITION,
    usernameSelector: 'input[name="email"], input[type="email"], input#email',
    passwordSelector: 'input[name="password"], input[type="password"], input#password',
    submitSelector: 'button[type="submit"], button[data-test-id*="login"], button[data-qa*="login"]',
  },
};

function buildWaitForSelectorsScript({ usernameSelector, passwordSelector, submitSelector }) {
  return `(() => new Promise((resolve) => {
    const selectors = ${JSON.stringify([usernameSelector, passwordSelector, submitSelector])};
    const deadline = Date.now() + ${SELECTOR_TIMEOUT_MS};
    const check = () => {
      const found = selectors.map((s) => Boolean(document.querySelector(s)));
      if (found.every(Boolean)) return resolve({ ok: true, found });
      if (Date.now() > deadline) return resolve({ ok: false, found });
      requestAnimationFrame(check);
    };
    check();
  }))()`;
}

function buildSubmitScript({ usernameSelector, passwordSelector, submitSelector, username, password }) {
  return `(() => {
    const setValue = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      el.focus();
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const userOk = setValue(${JSON.stringify(usernameSelector)}, ${JSON.stringify(username)});
    const passOk = setValue(${JSON.stringify(passwordSelector)}, ${JSON.stringify(password)});
    const submit = document.querySelector(${JSON.stringify(submitSelector)});
    const beforeUrl = location.href;
    if (userOk && passOk && submit) submit.click();
    return { userOk, passOk, submitOk: Boolean(submit), beforeUrl };
  })()`;
}

async function collectPageState(cdp) {
  return evaluate(cdp, `(() => ({
    url: location.href,
    title: document.title,
    text: (document.body?.innerText || '').slice(0, 1500),
  }))()`);
}

/**
 * Map AuthorizedBulk outcome ('passed' | 'failed' | 'review') onto the
 * CasinoCredential validation status enum. "review" maps to "locked" because
 * the AuthorizedBulk classifier puts "captcha" / "rate limit" / "verify your
 * email" pages into review — exactly the cases where we don't want to keep
 * blasting the credential.
 */
function mapOutcomeToStatus(outcome) {
  if (outcome?.status === 'passed') return 'valid';
  if (outcome?.status === 'failed') return 'invalid';
  if (outcome?.status === 'review') return 'locked';
  return 'error';
}

/**
 * Validates a single credential by running a real headless login.
 * Returns { status, details, sessionId, finalUrl, pageTitle }.
 */
export async function validateCasinoCredential({ site, email, password }, { shouldAbort } = {}) {
  const cfg = SITE_CONFIG[site];
  if (!cfg) throw new Error(`Unsupported site: ${site}`);
  if (!email || !password) throw new Error('Email and password are required');

  const abortController = createAbortSignal(shouldAbort);
  let sessionId = null;
  let cdp = null;

  try {
    const sessionOpts = {
      ...buildAuCasinoSessionOptions(cfg.target, { keepAlive: false }),
      timeout: SESSION_TIMEOUT_SECONDS,
    };
    sessionOpts.userMetadata = {
      ...sessionOpts.userMetadata,
      launchedFrom: 'CasinoCredentials-Validator',
      role: 'credential-rotation-test',
    };

    const session = await bbClient.createSession(sessionOpts);
    sessionId = session.id;

    cdp = await connectCdp(session.connectUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await cdp.send('Page.navigate', { url: cfg.target.loginUrl });
    await waitForPageIdle(cdp, abortController.signal);

    const selectorState = await evaluate(
      cdp,
      buildWaitForSelectorsScript(cfg),
      {},
      SELECTOR_TIMEOUT_MS + 2_000
    );
    if (!selectorState?.ok) {
      return {
        status: 'error',
        details: 'Login form selectors not found — site layout may have changed.',
        sessionId,
      };
    }

    const fill = await evaluate(cdp, buildSubmitScript({
      ...cfg, username: email, password,
    }));
    if (!fill?.userOk || !fill?.passOk || !fill?.submitOk) {
      return {
        status: 'error',
        details: 'Could not fill or submit the login form.',
        sessionId,
      };
    }

    await wait(POST_SUBMIT_SETTLE_MS, abortController.signal);
    await waitForPageIdle(cdp, abortController.signal, 10_000).catch(() => {});

    const state = await collectPageState(cdp);
    const classified = classifyAuthorizedBulkOutcome({
      beforeUrl: fill.beforeUrl,
      afterUrl: state?.url,
      title: state?.title,
      text: state?.text,
    });

    return {
      status: mapOutcomeToStatus(classified),
      details: classified.outcome || 'No outcome classified',
      sessionId,
      finalUrl: state?.url,
      pageTitle: state?.title,
    };
  } catch (err) {
    if (err?.name === 'AbortError' || shouldAbort?.()) {
      return { status: 'error', details: 'Validation aborted by operator', sessionId };
    }
    return { status: 'error', details: err?.message || 'Unknown error', sessionId };
  } finally {
    abortController.abort();
    cdp?.close();
    if (sessionId) {
      await bbClient.updateSession(sessionId, { status: 'REQUEST_RELEASE' }).catch(() => {});
    }
  }
}