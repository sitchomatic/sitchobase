export const AUTHORIZED_BULK_TERMINAL_STATUSES = new Set(['passed', 'review', 'failed']);

export function getAuthorizedBulkStats(rows = []) {
  const stats = {
    passed: 0,
    review: 0,
    failed: 0,
    running: 0,
    queued: 0,
    total: rows.length,
    completed: 0,
  };

  for (const row of rows) {
    const status = row.status || 'queued';
    if (stats[status] !== undefined) stats[status] += 1;
    if (AUTHORIZED_BULK_TERMINAL_STATUSES.has(status)) stats.completed += 1;
  }

  return stats;
}

export function updateRowByIndex(rows, patch) {
  const next = rows.slice();
  const position = next.findIndex((row) => row.index === patch.index);
  if (position === -1) return rows;
  next[position] = { ...next[position], ...patch };
  return next;
}