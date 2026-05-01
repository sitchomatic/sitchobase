/**
 * Complete Export utility.
 *
 * Bundles every diagnostic source — failed records, monitoring log buffer,
 * pattern clusters, remediation suggestions — into a single JSON or CSV
 * download for offline triage / sharing with engineers.
 */
import { getLogs } from '@/lib/monitoringLog';
import { clusterFailures } from './patterns';
import { suggestRemediation } from './remediations';

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function recordsToCSV(records) {
  const cols = ['id', 'source', 'when', 'target', 'pattern', 'message', 'remediation', 'swap'];
  const lines = [cols.join(',')];
  for (const rec of records) {
    const clusters = clusterFailures([rec]);
    const pattern = clusters[0]?.kind || 'unknown';
    const remedy = suggestRemediation(pattern);
    lines.push(cols.map((c) => csvEscape({
      id: rec.id, source: rec.source, when: rec.when, target: rec.target,
      pattern, message: rec.message, remediation: remedy.action, swap: remedy.swap,
    }[c])).join(','));
  }
  return lines.join('\n');
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
  triggerDownload(`diagnostics-export-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export function exportCompleteCSV(records) {
  triggerDownload(`diagnostics-export-${Date.now()}.csv`, recordsToCSV(records), 'text/csv');
}