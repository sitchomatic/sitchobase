const SUCCESS_STATUSES = new Set(['COMPLETED']);
const FAILURE_STATUSES = new Set(['ERROR', 'TIMED_OUT', 'FAILED']);
const ACTIVE_STATUSES = new Set(['RUNNING', 'PENDING']);

function parseTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function dayKey(time) {
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hourKey(time) {
  return new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function normalizeStatus(status) {
  return String(status || 'UNKNOWN').toUpperCase();
}

export function buildFleetInsights(sessions = []) {
  const now = Date.now();
  const sorted = [...sessions].sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt));
  const totals = { total: sorted.length, success: 0, failed: 0, active: 0, pending: 0 };
  const statusCounts = new Map();
  const regionCounts = new Map();
  const daily = new Map();
  const recent = [];

  for (const session of sorted) {
    const status = normalizeStatus(session.status);
    const created = parseTime(session.createdAt) || now;
    const region = session.region || 'unknown';

    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);

    if (SUCCESS_STATUSES.has(status)) totals.success += 1;
    if (FAILURE_STATUSES.has(status)) totals.failed += 1;
    if (ACTIVE_STATUSES.has(status)) totals.active += 1;
    if (status === 'PENDING') totals.pending += 1;

    const key = dayKey(created);
    const bucket = daily.get(key) || { date: key, sessions: 0, success: 0, failed: 0 };
    bucket.sessions += 1;
    if (SUCCESS_STATUSES.has(status)) bucket.success += 1;
    if (FAILURE_STATUSES.has(status)) bucket.failed += 1;
    daily.set(key, bucket);

    if (recent.length < 8) {
      recent.push({
        id: session.id,
        status,
        region,
        createdAt: session.createdAt,
        label: hourKey(created),
      });
    }
  }

  const successRate = totals.total ? Math.round((totals.success / totals.total) * 100) : 100;
  const failureRate = totals.total ? Math.round((totals.failed / totals.total) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, successRate - Math.round(failureRate / 2) + (totals.active ? 2 : 0)));

  return {
    totals,
    successRate,
    failureRate,
    healthScore,
    dailyTrend: Array.from(daily.values()).slice(-10),
    statusBreakdown: Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value })),
    regionBreakdown: Array.from(regionCounts.entries()).map(([region, count]) => ({ region, count })).slice(0, 8),
    recent,
  };
}