/**
 * Aggregates failed runs from every available source into a single
 * normalised list of records: { id, source, when, target, message, raw }.
 *
 * Sources:
 *   - JoeIgniteRun           (status: error / temp_lock / perm_ban / no_account)
 *   - AuthorizedBulkQARun    (per-row results.status === 'failed')
 *   - monitoringLog buffer   (in-memory liveLook errors)
 */
import { base44 } from '@/api/base44Client';
import { getLogs } from '@/lib/monitoringLog';

const FAILED_JOE_STATUSES = ['error', 'temp_lock', 'perm_ban', 'no_account'];

export async function loadFailedRecords({ limit = 200 } = {}) {
  const [joeRuns, bulkRuns] = await Promise.all([
    base44.entities.JoeIgniteRun.list('-created_date', limit).catch(() => []),
    base44.entities.AuthorizedBulkQARun.list('-startedAt', 50).catch(() => []),
  ]);

  const records = [];

  for (const r of joeRuns) {
    if (!FAILED_JOE_STATUSES.includes(r.status)) continue;
    records.push({
      id: r.id,
      source: 'JoeIgniteRun',
      when: r.endedAt || r.startedAt || r.created_date,
      target: r.email || '—',
      message: r.details || `Joe/Ignite ${r.status}`,
      raw: r,
    });
  }

  for (const run of bulkRuns) {
    const rows = Array.isArray(run.results) ? run.results : [];
    for (const row of rows) {
      if (row.status !== 'failed') continue;
      records.push({
        id: `${run.id}:${row.index}`,
        source: 'AuthorizedBulkQARun',
        when: row.endedAt || row.startedAt || run.startedAt,
        target: `${run.targetHost} · ${row.username || '—'}`,
        message: row.outcome || 'Failed',
        raw: { run, row },
      });
    }
  }

  for (const entry of getLogs()) {
    if (entry.ok) continue;
    records.push({
      id: entry.id,
      source: 'monitoringLog',
      when: entry.timestamp,
      target: `${entry.provider} · ${entry.op}`,
      message: entry.error_summary || entry.hint || 'Failure',
      raw: entry,
    });
  }

  records.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
  return records;
}