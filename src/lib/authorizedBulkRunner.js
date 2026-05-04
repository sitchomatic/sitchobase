import { bbClient } from '@/lib/bbClient';
import { connectCdp, createAbortSignal, evaluate, wait, waitForPageIdle } from '@/lib/authorizedBulkCdp';
import { classifyAuthorizedBulkOutcome } from '@/lib/authorizedBulkOutcome';
import { clampConcurrency } from '@/lib/authorizedBulkValidation';
import { captureStepScreenshot, getAutomationObservabilitySettings, startScreenshotPoller, upsertAutomationEvidence } from '@/lib/automationObservability';
import { storeSnapshot } from '@/lib/diagnostics/snapshotCache';
import { classifyRetryFailure, getRetryDelayMs, isPermanentFailureType, normalizeRetryPolicy, shouldRetryFailure } from '@/lib/authorizedBulkRetryPolicy';

const SESSION_TIMEOUT_SECONDS = 60;
const SELECTOR_TIMEOUT_MS = 12_000;
const POST_SUBMIT_SETTLE_MS_BASE = 2_000;
function settleDelay() {
  return Math.round(POST_SUBMIT_SETTLE_MS_BASE * (0.7 + Math.random() * 0.6));
}

function buildWaitForSelectorsScript({ usernameSelector, passwordSelector, submitSelector }) {
  return `(() => new Promise((resolve) => {
    const selectors = ${JSON.stringify([usernameSelector, passwordSelector, submitSelector])};
    const deadline = Date.now() + ${SELECTOR_TIMEOUT_MS};
    const check = () => {
      const found = selectors.map((selector) => Boolean(document.querySelector(selector)));
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

async function runOne({ row, config, onRowUpdate, shouldAbort, runId, retryPolicy }) {
  const abortController = createAbortSignal(shouldAbort);
  let lastPatch = null;
  const update = (patch) => {
    lastPatch = { index: row.index, username: row.username, ...patch };
    onRowUpdate?.(lastPatch);
  };
  let sessionId = null;
  let cdp = null;
  let stopPoller = null;
  const evidenceSettings = getAutomationObservabilitySettings();
  const shouldCaptureStep = () => evidenceSettings.logVerbosityLevel === 'high';
  const captureEvidence = async (stepName, status = 'running') => {
    if (!cdp || !sessionId) return null;
    if (status !== 'failed' && !shouldCaptureStep()) return null;
    return captureStepScreenshot(cdp, {
      sessionId,
      stepName,
      source: 'AuthorizedBulkQA',
      runId,
      rowIndex: row.index,
      status,
    }).catch(() => null);
  };

  update({
    status: 'running',
    outcome: row.retryAttempt ? `Retry attempt ${row.retryAttempt}: launching browser session` : 'Launching browser session',
    retryAttempt: row.retryAttempt || 0,
    startedAt: new Date().toISOString(),
  });

  try {
    const session = await bbClient.createSession({
      keepAlive: false,
      timeout: SESSION_TIMEOUT_SECONDS,
      browserSettings: {
        viewport: { width: 1366, height: 768 },
        recordSession: evidenceSettings.enableVideoRecording,
      },
      userMetadata: {
        launchedFrom: 'AuthorizedBulkQA',
        targetHost: new URL(config.targetUrl).host,
        rowIndex: row.index,
      },
    });

    sessionId = session.id;
    // Always persist the session + recording URL link so the inspector embed
    // and timeline always have something to attach to, even on `low` verbosity.
    await upsertAutomationEvidence({
      sessionId,
      source: 'AuthorizedBulkQA',
      runId,
      rowIndex: row.index,
      recordingUrl: `https://www.browserbase.com/sessions/${sessionId}`,
      status: 'running',
    }).catch(() => null);
    update({ sessionId, outcome: 'Connecting to browser' });

    cdp = await connectCdp(session.connectUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 500ms background screenshot poller — only on `high` verbosity. On
    // `low`, evidence is captured only at major steps and on failure.
    if (evidenceSettings.logVerbosityLevel === 'high') {
      stopPoller = startScreenshotPoller(cdp, {
        sessionId,
        source: 'AuthorizedBulkQA',
        runId,
        rowIndex: row.index,
      });
    }

    update({ outcome: 'Loading target page' });
    await cdp.send('Page.navigate', { url: config.targetUrl });
    await waitForPageIdle(cdp, abortController.signal);
    await captureEvidence('Loaded target page');

    update({ outcome: 'Waiting for form controls' });
    const selectorState = await evaluate(cdp, buildWaitForSelectorsScript(config), {}, SELECTOR_TIMEOUT_MS + 2_000);
    if (!selectorState?.ok) {
      throw new Error('One or more configured selectors were not found before timeout.');
    }
    await captureEvidence('Form controls ready');

    update({ outcome: 'Submitting test row' });
    const fill = await evaluate(cdp, buildSubmitScript({ ...config, username: row.username, password: row.password }));
    if (!fill?.userOk || !fill?.passOk || !fill?.submitOk) {
      throw new Error('One or more configured selectors could not be used.');
    }

    await wait(settleDelay(), abortController.signal);
    await waitForPageIdle(cdp, abortController.signal, 8_000).catch(() => {});
    await captureEvidence('After submit');
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
    await upsertAutomationEvidence({ sessionId, source: 'AuthorizedBulkQA', runId, rowIndex: row.index, status: classified.status === 'passed' ? 'success' : 'review' }).catch(() => null);
  } catch (error) {
    const aborted = error?.name === 'AbortError' || shouldAbort?.();
    await captureEvidence('Failure state', aborted ? 'review' : 'failed');
    await upsertAutomationEvidence({ sessionId, source: 'AuthorizedBulkQA', runId, rowIndex: row.index, status: aborted ? 'review' : 'failed' }).catch(() => null);
    // Capture a small DOM snapshot for the Diagnostics view (in-memory only,
    // never persisted to the entity to keep records small).
    if (cdp && !aborted) {
      const snap = await collectPageState(cdp).catch(() => null);
      if (snap) storeSnapshot(`${runId}:${row.index}`, { ...snap, error: error.message, sessionId });
    }
    const failureType = classifyRetryFailure(error);
    const permanent = isPermanentFailureType(failureType);
    update({
      status: aborted || permanent ? 'review' : 'failed',
      outcome: aborted ? 'Stopped before this row finished' : (permanent ? `Human review required: ${error.message}` : error.message),
      failureType,
      retryable: !permanent,
      endedAt: new Date().toISOString(),
    });
  } finally {
    abortController.abort();
    if (stopPoller) await stopPoller().catch(() => {});
    cdp?.close();
    await releaseSession(sessionId);
  }
  return lastPatch;
}

export async function runAuthorizedBulkQA({ rows, config, concurrency, onRowUpdate, shouldAbort, runId, retryPolicy }) {
  const startedAt = Date.now();
  const policy = normalizeRetryPolicy(retryPolicy);
  const queue = rows.map((row) => ({ ...row, retryAttempt: 0 }));
  const workerCount = Math.min(clampConcurrency(concurrency), queue.length || 1);

  const worker = async () => {
    while (queue.length) {
      if (shouldAbort?.()) {
        const skipped = queue.splice(0);
        skipped.forEach((row) => onRowUpdate?.({
          index: row.index,
          username: row.username,
          status: 'review',
          outcome: 'Skipped because run was stopped',
          endedAt: new Date().toISOString(),
        }));
        return;
      }

      const row = queue.shift();
      if (row) {
        const result = await runOne({ row, config, onRowUpdate, shouldAbort, runId, retryPolicy: policy });
        const latestAttempt = row.retryAttempt || 0;
        const retryAttempt = latestAttempt + 1;
        const failureType = result?.failureType;
        if (result?.status === 'failed' && !shouldAbort?.() && shouldRetryFailure(policy, failureType, retryAttempt)) {
          const retryDelayMs = getRetryDelayMs(policy, retryAttempt);
          onRowUpdate?.({
            index: row.index,
            username: row.username,
            status: 'queued',
            outcome: `Retry ${retryAttempt}/${policy.maxRetries} scheduled after ${retryDelayMs}ms for ${failureType}`,
            retryAttempt,
            retryDelayMs,
          });
          await wait(retryDelayMs);
          queue.push({ ...row, retryAttempt, failureType });
        }
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { durationMs: Date.now() - startedAt };
}