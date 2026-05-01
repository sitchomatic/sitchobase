/**
 * Complete Export utility.
 *
 * Bundles every diagnostic source — failed records, monitoring log buffer,
 * pattern clusters, remediation suggestions — into a single JSON or CSV
 * download for offline triage / sharing with engineers.
 */
import { getLogs } from '@/lib/monitoringLog';
import { rowsToCSV, downloadFile } from '@/lib/csvExport';
import { clusterFailures } from './patterns';
import { suggestRemediation } from './remediations';

const CSV_COLS = ['id', 'source', 'when', 'target', 'pattern', 'message', 'remediation', 'swap'];

function recordsToCSV(records) {
  const flat = records.map((rec) => {
    const pattern = clusterFailures([rec])[0]?.kind || 'unknown';
    const remedy = suggestRemediation(pattern);
    return {
      id: rec.id, source: rec.source, when: rec.when, target: rec.target,
      pattern, message: rec.message, remediation: remedy.action, swap: remedy.swap,
    };
  });
  return rowsToCSV(flat, CSV_COLS);
}

export function exportCompleteJSON(records, ctx = {}) {
  const clusters = clusterFailures(records).map((c) => ({
    kind: c.kind,
    label: c.label,
    count: c.items.length,
    remediation: suggestRemediation(c.kind, ctx),
    sample_ids: c.items.slice(0, 25).map((i) => i.id),
  }));
  const payload = {
    exported_at: new Date().toISOString(),
    summary: {
      total_failures: records.length,
      patterns_detected: clusters.length,
      proxy_healthy: ctx.proxyHealthy ?? null,
      credentials_available: ctx.credentialsAvailable ?? null,
    },
    clusters,
    records,
    monitoring_log: getLogs(),
  };
  downloadFile(`diagnostics-export-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export function exportCompleteCSV(records) {
  downloadFile(`diagnostics-export-${Date.now()}.csv`, recordsToCSV(records), 'text/csv');
}