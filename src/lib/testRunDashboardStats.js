const ACTIVE_STATUSES = new Set(['running', 'pending', 'queued']);
const SUCCESS_STATUSES = new Set(['completed', 'success']);
const FAILED_STATUSES = new Set(['failed', 'error', 'stopped']);

function normalize(value) {
  return String(value || '').toLowerCase();
}

function getTotal(run) {
  return run.totalRows || run.totalCredentials || 0;
}

function getPassed(run) {
  return run.passedCount || 0;
}

function getFailed(run) {
  return run.failedCount || 0;
}

export function buildDashboardTestRunStats(bulkRuns = [], testRuns = []) {
  const allRuns = [
    ...bulkRuns.map((run) => ({ ...run, source: 'Authorized QA', total: getTotal(run), passed: getPassed(run), failed: getFailed(run) })),
    ...testRuns.map((run) => ({ ...run, source: 'Test Suite', total: getTotal(run), passed: getPassed(run), failed: getFailed(run) })),
  ];

  let active = 0;
  let completed = 0;
  let failed = 0;
  let passedRows = 0;
  let totalRows = 0;

  for (const run of allRuns) {
    const status = normalize(run.status);
    if (ACTIVE_STATUSES.has(status)) active += 1;
    if (SUCCESS_STATUSES.has(status)) completed += 1;
    if (FAILED_STATUSES.has(status)) failed += 1;
    passedRows += run.passed;
    totalRows += run.total;
  }

  const successRate = totalRows ? Math.round((passedRows / totalRows) * 100) : 100;
  const statusData = [
    { name: 'Active', value: active },
    { name: 'Completed', value: completed },
    { name: 'Failed', value: failed },
  ];

  const trendData = allRuns
    .slice()
    .sort((a, b) => new Date(a.startedAt || a.created_date || 0) - new Date(b.startedAt || b.created_date || 0))
    .slice(-8)
    .map((run, index) => ({
      name: `Run ${index + 1}`,
      success: run.total ? Math.round((run.passed / run.total) * 100) : 0,
      failed: run.failed,
    }));

  return { active, completed, failed, successRate, totalRuns: allRuns.length, statusData, trendData };
}