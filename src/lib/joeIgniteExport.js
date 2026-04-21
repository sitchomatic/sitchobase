/**
 * Build CSV strings mirroring the Python script's per-outcome log files.
 * Returns a map of { filename: csvText } for download.
 */
const HEADER = ['SessionID', 'email', 'outcome', 'attempts', 'timestamp', 'details'];

function escape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows) {
  const lines = [HEADER.join(',')];
  for (const r of rows) {
    lines.push([
      r.sessionId || '',
      r.email,
      (r.status || '').toUpperCase(),
      r.attempts || 0,
      r.startedAt || '',
      r.details || JSON.stringify({ joe: r.joeOutcome, ignition: r.ignitionOutcome, isBurned: r.isBurned }),
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

export function buildJoeIgniteExports(rows) {
  const buckets = {
    'success_log.csv':   rows.filter((r) => r.status === 'success'),
    'perm_disabled.csv': rows.filter((r) => r.status === 'perm_ban'),
    'temp_disabled.csv': rows.filter((r) => r.status === 'temp_lock'),
    'no_account.csv':    rows.filter((r) => r.status === 'no_account'),
    'error_log.csv':     rows.filter((r) => r.status === 'error'),
  };
  const out = {};
  for (const [name, subset] of Object.entries(buckets)) out[name] = toCSV(subset);
  return out;
}

export function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}