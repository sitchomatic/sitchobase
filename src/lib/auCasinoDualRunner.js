/**
 * Dual-target validation runner — for every credential row, launches one
 * Browserbase session per AU casino target (Joe Fortune + Ignition) in
 * parallel under the AU mobile / residential proxy preset.
 *
 * Reuses every existing primitive:
 *   - bbClient.createSession (going through bbProxy or direct path)
 *   - buildAuCasinoSessionOptions for stealth / region / fingerprint
 *   - authorizedBulkCdp helpers (connectCdp, evaluate, wait, idle)
 *   - automationObservability (CDP screenshot poller + AutomationEvidence)
 *   - classifyAuthorizedBulkOutcome for pass/review/failed labelling
 *
 * Each (row, target) pair becomes its own "task" with its own session,
 * its own evidence record, and its own status — so the UI shows a
 * sub-row per target inside each credential row.
 */
import { bbClient } from '@/lib/bbClient';
import { connectCdp, createAbortSignal, evaluate, wait, waitForPageIdle } from '@/lib/authorizedBulkCdp';
import { classifyAuthorizedBulkOutcome } from '@/lib/authorizedBulkOutcome';
import {
  captureStepScreenshot,
  getAutomationObservabilitySettings,
  startScreenshotPoller,
  upsertAutomationEvidence,
} from '@/lib/automationObservability';
import { AU_CASINO_TARGETS, buildAuCasinoSessionOptions } from '@/lib/auCasino';

// Same conservative defaults as the single-target Authorized Bulk runner.
const SESSION_TIMEOUT_SECONDS = 60;
const SELECTOR_TIMEOUT_MS = 12_000;
const POST_SUBMIT_SETTLE_MS = 2_500;
const MAX_TASK_CONCURRENCY = 6;

// Heuristic selectors — both casinos use the same Bovada/Pai Wow stack
// so a single set of broad selectors works for both. We try each option
// in order via document.querySelector, so the first one to match wins.
const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[id*="email" i]',
  'input[id*="user" i]',
];
const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name="password"]',
  'input[id*="password" i]',
];
const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button[name="login"]',
  'button[id*="login" i]',
  'button[id*="submit" i]',
];

function buildFindSelectorsScript() {
  return `(() => new Promise((resolve) => {
    const userOpts = ${JSON.stringify(USERNAME_SELECTORS)};
    const passOpts = ${JSON.stringify(PASSWORD_SELECTORS)};
    const submitOpts = ${JSON.stringify(SUBMIT_SELECTORS)};
    const deadline = Date.now() + ${SELECTOR_TIMEOUT_MS};
    const firstMatch = (selectors) => selectors.find((s) => document.querySelector(s)) || null;
    const check = () => {
      const user = firstMatch(userOpts);
      const pass = firstMatch(passOpts);
      const submit = firstMatch(submitOpts);
      if (user && pass && submit) return resolve({ ok: true, user, pass, submit });
      if (Date.now() > deadline) return resolve({ ok: false, user, pass, submit });
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
      const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
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

async function releaseSession(sessionId) {
  if (!sessionId) return;
  await bbClient.updateSession(sessionId, { status: 'REQUEST_RELEASE' }).catch(() => {});
}

/** Run a single (row × target) task end-to-end. */
async function runTask({ row, target, runId, onTaskUpdate, shouldAbort }) {
  const taskKey = `${row.index}:${target.key}`;
  const abortController = createAbortSignal(shouldAbort);
  const update = (patch) => onTaskUpdate?.({ rowIndex: row.index, targetKey: target.key, taskKey, ...patch });
  const evidenceSettings = getAutomationObservabilitySettings();
  const verbose = evidenceSettings.logVerbosityLevel === 'high';

  let sessionId = null;
  let cdp = null;
  let stopPoller = null;

  const captureEvidence = async (stepName, status = 'running') => {
    if (!cdp || !sessionId) return null;
    if (status !== 'failed' && !verbose) return null;
    return captureStepScreenshot(cdp, {
      sessionId,
      stepName,
      source: 'AUCasinoDualValidation',
      runId,
      rowIndex: row.index,
      status,
    }).catch(() => null);
  };

  update({
    status: 'running',
    outcome: `Launching ${target.label} session…`,
    startedAt: new Date().toISOString(),
  });

  try {
    const options = {
      ...buildAuCasinoSessionOptions(target, { keepAlive: false }),
      timeout: SESSION_TIMEOUT_SECONDS,
      browserSettings: {
        ...buildAuCasinoSessionOptions(target).browserSettings,
        recordSession: evidenceSettings.enableVideoRecording,
      },
      userMetadata: {
        ...buildAuCasinoSessionOptions(target).userMetadata,
        launchedFrom: 'BBCommandCenter-AUCasinoDualValidation',
        rowIndex: row.index,
        runId,
      },
    };
    const session = await bbClient.createSession(options);
    sessionId = session.id;

    // Always link the session to AutomationEvidence so the inspector
    // tab in RowScreenshotsDialog has something to attach to.
    await upsertAutomationEvidence({
      sessionId,
      source: 'AUCasinoDualValidation',
      runId,
      rowIndex: row.index,
      recordingUrl: `https://www.browserbase.com/sessions/${sessionId}`,
      status: 'running',
    }).catch(() => null);

    update({ sessionId, outcome: 'Connecting to browser' });

    cdp = await connectCdp(session.connectUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    if (verbose) {
      stopPoller = startScreenshotPoller(cdp, {
        sessionId,
        source: 'AUCasinoDualValidation',
        runId,
        rowIndex: row.index,
      });
    }

    update({ outcome: `Loading ${target.label}` });
    await cdp.send('Page.navigate', { url: target.loginUrl });
    await waitForPageIdle(cdp, abortController.signal);
    await captureEvidence(`${target.label} — initial load`);

    update({ outcome: 'Locating login form' });
    const found = await evaluate(cdp, buildFindSelectorsScript(), {}, SELECTOR_TIMEOUT_MS + 2_000);
    if (!found?.ok) {
      throw new Error('Login form not detected within timeout (selectors may have changed).');
    }
    await captureEvidence(`${target.label} — form ready`);

    update({ outcome: 'Submitting credentials' });
    const fill = await evaluate(cdp, buildSubmitScript({
      usernameSelector: found.user,
      passwordSelector: found.pass,
      submitSelector: found.submit,
      username: row.username,
      password: row.password,
    }));
    if (!fill?.userOk || !fill?.passOk || !fill?.submitOk) {
      throw new Error('Could not fill or submit the detected form.');
    }

    await wait(POST_SUBMIT_SETTLE_MS, abortController.signal);
    await waitForPageIdle(cdp, abortController.signal, 8_000).catch(() => {});
    await captureEvidence(`${target.label} — after submit`);

    const state = await collectPageState(cdp);
    const classified = classifyAuthorizedBulkOutcome({
      beforeUrl: fill.beforeUrl,
      afterUrl: state?.url,
      title: state?.title,
      text: state?.text,
    });

    update({
      ...classified,
      finalUrl: state?.url,
      pageTitle: state?.title,
      endedAt: new Date().toISOString(),
    });
    await upsertAutomationEvidence({
      sessionId,
      source: 'AUCasinoDualValidation',
      runId,
      rowIndex: row.index,
      status: classified.status === 'passed' ? 'success' : 'review',
    }).catch(() => null);
  } catch (error) {
    const aborted = error?.name === 'AbortError' || shouldAbort?.();
    await captureEvidence(`${target.label} — failure`, aborted ? 'review' : 'failed');
    await upsertAutomationEvidence({
      sessionId,
      source: 'AUCasinoDualValidation',
      runId,
      rowIndex: row.index,
      status: aborted ? 'review' : 'failed',
    }).catch(() => null);
    update({
      status: aborted ? 'review' : 'failed',
      outcome: aborted ? 'Stopped before this task finished' : (error.message || 'Task failed'),
      endedAt: new Date().toISOString(),
    });
  } finally {
    abortController.abort();
    if (stopPoller) await stopPoller().catch(() => {});
    cdp?.close();
    await releaseSession(sessionId);
  }
}

/**
 * Run dual-target validation across `rows`. Generates `rows.length × 2`
 * tasks (one per row × target) and runs them with bounded concurrency.
 *
 * onTaskUpdate fires for every status change on every (row, target) pair.
 */
export async function runAuCasinoDualValidation({ rows, concurrency = 2, onTaskUpdate, shouldAbort, runId }) {
  const startedAt = Date.now();
  const tasks = [];
  for (const row of rows) {
    for (const target of AU_CASINO_TARGETS) {
      tasks.push({ row, target });
    }
  }

  const queue = tasks.slice();
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), MAX_TASK_CONCURRENCY, queue.length || 1);

  const worker = async () => {
    while (queue.length) {
      if (shouldAbort?.()) {
        const skipped = queue.splice(0);
        for (const skip of skipped) {
          onTaskUpdate?.({
            rowIndex: skip.row.index,
            targetKey: skip.target.key,
            taskKey: `${skip.row.index}:${skip.target.key}`,
            status: 'review',
            outcome: 'Skipped because run was stopped',
            endedAt: new Date().toISOString(),
          });
        }
        return;
      }
      const next = queue.shift();
      if (next) await runTask({ ...next, runId, onTaskUpdate, shouldAbort });
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { durationMs: Date.now() - startedAt, taskCount: tasks.length };
}