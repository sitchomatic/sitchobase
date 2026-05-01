/**
 * Shared in-memory ring buffer for Browser Monitoring logs.
 *
 * Why module-level (not React context)?
 *   - The buffer needs to survive page-level renders without prop drilling
 *     and is written from many leaf components (every provider section).
 *   - We expose a tiny pub/sub so the LogExportPanel can re-render whenever
 *     a new entry lands without forcing parents to lift state.
 *
 * Each entry is plain JSON-safe data (no DOM refs / Response objects), so
 * `JSON.stringify` works without surprises for the export feature.
 */
const MAX_ENTRIES = 500;
const buffer = [];
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(buffer);
}

/**
 * Append a structured entry. Caller may pass a partial — we fill defaults.
 * Returns the stored entry (with id + timestamp) so callers can correlate.
 */
export function appendLog(entry) {
  const stored = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level: entry.ok === false ? 'error' : (entry.level || 'info'),
    provider: entry.provider || 'unknown',
    op: entry.op || 'unknown',
    duration_ms: entry.duration_ms ?? null,
    upstream_status: entry.upstream_status ?? null,
    ok: entry.ok !== false,
    error_kind: entry.error_kind || null,
    error_summary: entry.error_summary || null,
    hint: entry.hint || null,
    request_id: entry.request_id || null,
    extra: entry.extra || null,
  };
  buffer.unshift(stored);
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES;
  notify();
  return stored;
}

/**
 * Convenience: push a log entry from a `liveLook` invoke result.
 * Accepts the raw axios-style { data: { ok, error, _log } } response.
 */
export function appendFromInvoke(res, fallback = {}) {
  const body = res?.data || {};
  const meta = body._log || {};
  return appendLog({
    provider: meta.provider || fallback.provider,
    op: meta.op || fallback.op,
    duration_ms: meta.duration_ms,
    upstream_status: meta.upstream_status,
    ok: body.ok,
    error_kind: meta.error_kind,
    error_summary: body.ok ? null : (meta.error_summary || body.error),
    hint: meta.hint,
    request_id: meta.request_id,
    extra: fallback.extra || null,
  });
}

export function getLogs() {
  return buffer.slice();
}

export function clearLogs() {
  buffer.length = 0;
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Convert the buffer to CSV. We pin a stable column order so spreadsheets
 * line up across exports.
 */
import { rowsToCSV } from '@/lib/csvExport';

const CSV_COLS = ['timestamp', 'level', 'provider', 'op', 'duration_ms', 'upstream_status', 'ok', 'error_kind', 'error_summary', 'hint', 'request_id'];

export function toCSV(entries = buffer) {
  return rowsToCSV(entries, CSV_COLS);
}