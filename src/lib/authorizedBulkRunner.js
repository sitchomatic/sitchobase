import { bbClient } from '@/lib/bbClient';
import { connectCdp, createAbortSignal, evaluate, wait, waitForPageIdle } from '@/lib/authorizedBulkCdp';
import { classifyAuthorizedBulkOutcome } from '@/lib/authorizedBulkOutcome';
import { clampConcurrency } from '@/lib/authorizedBulkValidation';
import { captureStepScreenshot, getAutomationObservabilitySettings, upsertAutomationEvidence } from '@/lib/automationObservability';

const SESSION_TIMEOUT_SECONDS = 60;
const SELECTOR_TIMEOUT_MS = 12_000;
const POST_SUBMIT_SETTLE_MS = 2_000;

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

async function runOne({ row, config, onRowUpdate, shouldAbort, runId }) {
  const abortController = createAbortSignal(shouldAbort);
  const update = (patch) => onRowUpdate?.({ index: row.index, username: row.username, ...patch });
  let sessionId = null;
  let cdp = null;
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

  update({ status: 'running', outcome: 'Launching browser session', startedAt: new Date().toISOString() });

  try {
    const session = await bbClient.createSession({
      keepAlive: false,
      timeout: SESSION_TIMEOUT_SECONDS,
      browserSettings: { viewport: { width: 1366, height: 768 } },
      userMetadata: {
        launchedFrom: 'AuthorizedBulkQA',
        targetHost: new URL(config.targetUrl).host,
        rowIndex: row.index,
      },
    });

    sessionId = session.id;
    if (evidenceSettings.enableVideoRecording) {
      await upsertAutomationEvidence({
        sessionId,
        source: 'AuthorizedBulkQA',
        runId,
        rowIndex: row.index,
        recordingUrl: `https://www.browserbase.com/sessions/${sessionId}`,
        status: 'running',
      }).catch(() => null);
    }
    update({ sessionId, outcome: 'Connecting to browser' });

    cdp = await connectCdp(session.connectUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

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

    await wait(POST_SUBMIT_SETTLE_MS, abortController.signal);
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
    update({
      status: aborted ? 'review' : 'failed',
      outcome: aborted ? 'Stopped before this row finished' : error.message,
      endedAt: new Date().toISOString(),
    });
  } finally {
    abortController.abort();
    cdp?.close();
    await releaseSession(sessionId);
  }
}

export async function runAuthorizedBulkQA({ rows, config, concurrency, onRowUpdate, shouldAbort, runId }) {
  const startedAt = Date.now();
  const queue = [...rows];
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
      if (row) await runOne({ row, config, onRowUpdate, shouldAbort, runId });
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { durationMs: Date.now() - startedAt };
}