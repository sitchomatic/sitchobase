/**
 * Shared CSV utilities. Replaces three near-identical implementations that
 * were drifting (`pages/AuthorizedBulkQA.jsx`, `lib/monitoringLog.js`,
 * `lib/diagnostics/exporter.js`).
 */

export function csvEscape(value) {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from rows + a fixed column list. */
export function rowsToCSV(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r?.[c])).join(','))].join('\n');
}

/** Trigger a browser download for any text/blob content. */
export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}