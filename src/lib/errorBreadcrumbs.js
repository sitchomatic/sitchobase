/**
 * In-memory breadcrumb ring buffer captured by the frontend error reporter.
 * Holds the last ~50 navigations + console errors/warnings + manual notes.
 * Bundled into the error export so we can see what the user was doing
 * just before the failure even when no stack trace is captured.
 */
const MAX = 50;
const buffer = [];

export function addBreadcrumb(type, data) {
  buffer.push({ t: new Date().toISOString(), type, ...data });
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

export function getBreadcrumbs() {
  return buffer.slice();
}

export function clearBreadcrumbs() {
  buffer.length = 0;
}