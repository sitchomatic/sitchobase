/**
 * Compute per-provider efficiency metrics from JoeIgniteRun + ProxyPool data.
 *
 * Inputs:
 *   runs       — JoeIgniteRun records (already filtered to the time window)
 *   proxies    — ProxyPool records (for provider mapping / pool size)
 *   costPerMin — USD per browser minute (e.g. 0.009)
 *
 * Output: array of { provider, proxyCount, total, success, failure,
 *   successRate, ratio, avgLatencySec, totalMinutes, costUsd,
 *   costPerSuccess }, sorted by total runs desc.
 *
 * Terminology:
 *   "latency" — we don't have per-request latency. We use the mean session
 *   duration (endedAt − startedAt) as a reasonable proxy for how long a
 *   login attempt through that provider took end-to-end.
 */
import { inferProxyProvider } from '@/lib/proxyProvider';

const SUCCESS_STATUSES = new Set(['success']);
const FAILURE_STATUSES = new Set(['temp_lock', 'perm_ban', 'no_account', 'error']);

export function computeProxyEfficiency({ runs, proxies = [], costPerMin = 0.009 }) {
  // provider -> counters
  const byProvider = new Map();

  const ensure = (provider) => {
    let row = byProvider.get(provider);
    if (!row) {
      row = {
        provider,
        proxyCount: 0,
        total: 0,
        success: 0,
        failure: 0,
        other: 0,
        totalSeconds: 0,
        durationSamples: 0,
      };
      byProvider.set(provider, row);
    }
    return row;
  };

  // Count proxies per provider from the pool
  for (const p of proxies) {
    if (p.enabled === false) continue;
    const prov = inferProxyProvider(p);
    ensure(prov).proxyCount++;
  }

  // Aggregate run outcomes
  for (const run of runs) {
    const provider = run.proxyProvider || 'none';
    const row = ensure(provider);
    row.total++;

    if (SUCCESS_STATUSES.has(run.status)) row.success++;
    else if (FAILURE_STATUSES.has(run.status)) row.failure++;
    else row.other++;

    if (run.startedAt && run.endedAt) {
      const dur = (new Date(run.endedAt) - new Date(run.startedAt)) / 1000;
      if (dur > 0 && dur < 60 * 60) { // ignore obviously-broken timestamps
        row.totalSeconds += dur;
        row.durationSamples++;
      }
    }
  }

  // Finalize
  const out = [];
  for (const row of byProvider.values()) {
    const attempted = row.success + row.failure;
    const successRate = attempted > 0 ? row.success / attempted : 0;
    const ratio = row.failure > 0
      ? row.success / row.failure
      : (row.success > 0 ? Infinity : 0);
    const avgLatencySec = row.durationSamples > 0
      ? row.totalSeconds / row.durationSamples
      : 0;
    const totalMinutes = row.totalSeconds / 60;
    const costUsd = totalMinutes * costPerMin;
    const costPerSuccess = row.success > 0 ? costUsd / row.success : null;

    out.push({
      provider: row.provider,
      proxyCount: row.proxyCount,
      total: row.total,
      success: row.success,
      failure: row.failure,
      other: row.other,
      successRate,
      ratio,
      avgLatencySec,
      totalMinutes,
      costUsd,
      costPerSuccess,
    });
  }

  return out.sort((a, b) => b.total - a.total);
}

export function formatRatio(ratio) {
  if (!isFinite(ratio)) return '∞';
  if (ratio === 0) return '—';
  return ratio.toFixed(2);
}

export function formatLatency(sec) {
  if (!sec) return '—';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${(sec / 60).toFixed(1)}m`;
}

export function formatCostPerSuccess(c) {
  if (c === null || c === undefined) return '—';
  if (c < 0.01) return '<$0.01';
  return `$${c.toFixed(3)}`;
}