/**
 * Client-side error capture (#19).
 * Wires window.onerror + unhandledrejection + console.error to the
 * FrontendError entity, captures navigation breadcrumbs, and dedupes/rate-limits
 * writes so a loop of failures can't flood the DB.
 *
 * The breadcrumb ring buffer is bundled into the error export so we can see
 * what the user was doing leading up to the failure even when no stack
 * trace is captured.
 */
import { base44 } from '@/api/base44Client';
import { addBreadcrumb } from '@/lib/errorBreadcrumbs';

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
  const key = `${source}:${String(message).slice(0, 120)}`;
  // Always record to the in-memory breadcrumb buffer — even if rate-limited
  // or deduped, the bundle export should still see it.
  addBreadcrumb('error', { source, message: String(message).slice(0, 200), requestId });
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

  // Initial route breadcrumb
  addBreadcrumb('navigation', { url: window.location.pathname });

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

  // SPA navigation breadcrumb — patch history methods so route changes
  // get recorded even though they don't fire 'popstate'.
  const recordNav = () => addBreadcrumb('navigation', { url: window.location.pathname });
  window.addEventListener('popstate', recordNav);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) { const r = origPush.apply(this, args); recordNav(); return r; };
  history.replaceState = function (...args) { const r = origReplace.apply(this, args); recordNav(); return r; };

  // Console.error breadcrumb (does NOT create FrontendError records — too
  // noisy — but it gives context inside the bundle).
  const origConsoleError = console.error;
  console.error = function (...args) {
    addBreadcrumb('console.error', { message: args.map((a) => (a?.message || String(a))).join(' ').slice(0, 300) });
    return origConsoleError.apply(this, args);
  };
}