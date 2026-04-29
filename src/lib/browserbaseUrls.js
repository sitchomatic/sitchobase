/**
 * Browserbase external URL helpers.
 *
 * Browserbase exposes two browser-facing URLs per session that are NOT part
 * of the REST payload but follow stable, documented formats:
 *
 *   1. Session Inspector / Replay
 *      https://www.browserbase.com/sessions/{sessionId}
 *      Shows the rrweb replay, network HAR, console, and screenshots for any
 *      session — running or completed. This is the URL operators actually
 *      mean when they ask to "watch the recording".
 *
 *   2. Live Debugger (running sessions only)
 *      Returned by GET /v1/sessions/{id}/debug as `debuggerFullscreenUrl`.
 *      We don't synthesize that one — it requires the per-session debug
 *      payload.
 *
 * Keeping these helpers in one place so every surface (Sessions list, detail
 * panel, Activity timeline, bulk-run rows) links to the same canonical URLs.
 */

export const BROWSERBASE_DASHBOARD_HOST = 'https://www.browserbase.com';

/**
 * Returns the public Browserbase Session Inspector / Replay URL for a session.
 * Works for any sessionId — including past, errored, and timed-out sessions.
 *
 * @param {string} sessionId
 * @returns {string|null} URL or null if no session id provided.
 */
export function sessionInspectorUrl(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return null;
  return `${BROWSERBASE_DASHBOARD_HOST}/sessions/${encodeURIComponent(sessionId)}`;
}