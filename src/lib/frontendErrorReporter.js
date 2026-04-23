/**
 * Client-side error capture (#19).
 * Wires window.onerror + unhandledrejection to the FrontendError entity.
 * Dedupes identical errors within a short window and rate-limits writes
 * so a loop of failures can't flood the DB.
 */
import { base44 } from '@/api/base44Client';

const DEDUP_WINDOW_MS = 30_000;
const MAX_PER_MINUTE = 10;
const recent = new Map(); // key -> lastAt
let sentThisMinute = 0;
let minuteStart = Date.now();

function shouldSend(key) {
  const now = Date.now();
  if (now - minuteStart > 60_000) { minuteStart = now; sentThisMinute = 0; }
  if (sentThisMinute >= MAX_PER_MINUTE) return false;
  const last = recent.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return false;
  recent.set(key, now);
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t > DEDUP_WINDOW_MS) recent.delete(k);
  }
  sentThisMinute++;
  return true;
}

export async function reportFrontendError({ message, stack, source, requestId }) {
  if (!message) return;
  const key = `${source}:${message.slice(0, 120)}`;
  if (!shouldSend(key)) return;
  try {
    await base44.entities.FrontendError.create({
      message: String(message).slice(0, 1000),
      stack: stack ? String(stack).slice(0, 4000) : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      source,
      request_id: requestId || '',
    });
  } catch { /* never let reporting break the app */ }
}

let installed = false;
export function installFrontendErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportFrontendError({
      message: event.message || (event.error?.message) || 'window error',
      stack: event.error?.stack,
      source: 'window_error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportFrontendError({
      message: reason?.message || String(reason) || 'unhandled rejection',
      stack: reason?.stack,
      source: 'unhandled_rejection',
      requestId: reason?.requestId,
    });
  });

  // Hook used by ErrorBoundary
  window.__bb_onError = ({ error }) => {
    reportFrontendError({
      message: error?.message || String(error),
      stack: error?.stack,
      source: 'render',
    });
  };
}