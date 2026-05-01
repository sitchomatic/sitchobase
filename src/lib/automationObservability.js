import { base44 } from '@/api/base44Client';

const VIDEO_KEY = 'automation_enable_video_recording';
const VERBOSITY_KEY = 'automation_log_verbosity_level';

export function getAutomationObservabilitySettings() {
  return {
    enableVideoRecording: localStorage.getItem(VIDEO_KEY) !== '0',
    logVerbosityLevel: localStorage.getItem(VERBOSITY_KEY) || 'high',
  };
}

export function saveAutomationObservabilitySettings({ enableVideoRecording, logVerbosityLevel }) {
  localStorage.setItem(VIDEO_KEY, enableVideoRecording ? '1' : '0');
  localStorage.setItem(VERBOSITY_KEY, logVerbosityLevel || 'high');
}

function base64ToFile(base64, fileName) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: 'image/jpeg' });
}

export async function upsertAutomationEvidence({ sessionId, source, runId, rowIndex, recordingUrl, screenshotLog, status = 'running' }) {
  if (!sessionId) return null;
  const existing = await base44.entities.AutomationEvidence.filter({ browserbaseSessionId: sessionId });
  const current = existing[0];
  const nextLogs = screenshotLog ? [...(current?.screenshotLogs || []), screenshotLog] : (current?.screenshotLogs || []);
  const payload = {
    browserbaseSessionId: sessionId,
    source,
    runId,
    rowIndex,
    recordingUrl: recordingUrl || `https://www.browserbase.com/sessions/${sessionId}`,
    screenshotLogs: nextLogs,
    status,
  };
  return current?.id
    ? base44.entities.AutomationEvidence.update(current.id, payload)
    : base44.entities.AutomationEvidence.create(payload);
}

export async function captureStepScreenshot(cdp, { sessionId, stepName, source, runId, rowIndex, status = 'running' }) {
  if (!cdp || !sessionId) return null;
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 70,
    captureBeyondViewport: true,
  }, 20_000);

  const safeName = String(stepName || 'step').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step';
  const file = base64ToFile(data, `session-${sessionId}-${safeName}-${Date.now()}.jpg`);
  const upload = await base44.integrations.Core.UploadFile({ file });
  const screenshotLog = {
    name: stepName,
    url: upload.file_url,
    timestamp: new Date().toISOString(),
    status,
  };

  await upsertAutomationEvidence({ sessionId, source, runId, rowIndex, screenshotLog, status });
  return screenshotLog;
}

/**
 * Start a 500ms screenshot poller for a session. Captures + uploads frames in
 * the background (best-effort: failures are swallowed so they never break the
 * automation flow). Persists frames to AutomationEvidence in batches every
 * `flushIntervalMs` to avoid hammering the entity API.
 *
 * Returns a stop() function that flushes pending frames and clears timers.
 */
export function startScreenshotPoller(cdp, { sessionId, source, runId, rowIndex, intervalMs = 500, flushIntervalMs = 2_000 } = {}) {
  if (!cdp || !sessionId) return () => {};
  let running = true;
  let inFlight = false;
  const buffer = [];

  const captureTick = async () => {
    if (!running || inFlight) return;
    inFlight = true;
    try {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 50,
        captureBeyondViewport: false,
      }, 5_000);
      const file = base64ToFile(data, `session-${sessionId}-frame-${Date.now()}.jpg`);
      const upload = await base44.integrations.Core.UploadFile({ file });
      buffer.push({ name: 'frame', url: upload.file_url, timestamp: new Date().toISOString(), status: 'running' });
    } catch {
      // best-effort only — never break the run for a missed frame
    } finally {
      inFlight = false;
    }
  };

  const flush = async () => {
    if (!buffer.length) return;
    const frames = buffer.splice(0);
    const existing = await base44.entities.AutomationEvidence.filter({ browserbaseSessionId: sessionId }).catch(() => []);
    const current = existing[0];
    const nextLogs = [...(current?.screenshotLogs || []), ...frames];
    const payload = {
      browserbaseSessionId: sessionId,
      source, runId, rowIndex,
      recordingUrl: current?.recordingUrl || `https://www.browserbase.com/sessions/${sessionId}`,
      screenshotLogs: nextLogs,
      status: current?.status || 'running',
    };
    if (current?.id) {
      await base44.entities.AutomationEvidence.update(current.id, payload).catch(() => null);
    } else {
      await base44.entities.AutomationEvidence.create(payload).catch(() => null);
    }
  };

  const captureTimer = setInterval(captureTick, intervalMs);
  const flushTimer = setInterval(() => { flush().catch(() => {}); }, flushIntervalMs);

  return async () => {
    running = false;
    clearInterval(captureTimer);
    clearInterval(flushTimer);
    await flush().catch(() => {});
  };
}