function dayKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function classifyFailure(row) {
  if (row?.failureType) return row.failureType;
  const outcome = String(row?.outcome || '').toLowerCase();
  if (outcome.includes('selector') || outcome.includes('form controls')) return 'selector_config';
  if (outcome.includes('timeout')) return 'timeout';
  if (outcome.includes('network') || outcome.includes('fetch')) return 'network';
  if (outcome.includes('stopped')) return 'stopped';
  return row?.status === 'review' ? 'manual_review' : 'unclassified';
}

export function buildFailureAnalytics(runs = []) {
  const byDay = new Map();
  const byType = new Map();
  const byHost = new Map();
  let totalRows = 0;
  let failureRows = 0;

  for (const run of runs) {
    const host = run.targetHost || 'unknown-host';
    const day = dayKey(run.startedAt || run.created_date);
    const rows = run.results || [];
    totalRows += rows.length || run.totalRows || 0;

    if (!byDay.has(day)) byDay.set(day, { date: day, total: 0, failures: 0, reviews: 0, passed: 0 });
    const dayBucket = byDay.get(day);

    for (const row of rows) {
      dayBucket.total += 1;
      if (row.status === 'passed') dayBucket.passed += 1;
      if (row.status === 'failed' || row.status === 'review') {
        failureRows += 1;
        dayBucket.failures += row.status === 'failed' ? 1 : 0;
        dayBucket.reviews += row.status === 'review' ? 1 : 0;

        const type = classifyFailure(row);
        byType.set(type, (byType.get(type) || 0) + 1);
        byHost.set(host, (byHost.get(host) || 0) + 1);
      }
    }
  }

  const timeline = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ ...item, failureRate: item.total ? Math.round(((item.failures + item.reviews) / item.total) * 1000) / 10 : 0 }));

  const failureTypes = Array.from(byType.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const targetHosts = Array.from(byHost.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return {
    timeline,
    failureTypes,
    targetHosts,
    totalRows,
    failureRows,
    failureRate: totalRows ? Math.round((failureRows / totalRows) * 1000) / 10 : 0,
  };
}