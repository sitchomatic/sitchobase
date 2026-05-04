/**
 * Heal-run helper for the QA History → Remediation panel.
 *
 * The original run record persists results WITHOUT passwords (privacy
 * contract — see entities/AuthorizedBulkQARun.json). To re-run failed
 * rows we therefore need the operator to re-supply the credentials for
 * just those usernames. This helper:
 *
 *   1. Matches the operator-supplied CSV against the failed-row usernames.
 *   2. Calls the existing browser-side runner with the original target +
 *      selectors so behaviour is identical to the parent run.
 *   3. Persists a child AuthorizedBulkQARun (parentRunId + isHealRun=true)
 *      so the comparison view can join parent ↔ child by username.
 */
import { base44 } from '@/api/base44Client';
import { runAuthorizedBulkQA } from '@/lib/authorizedBulkRunner';
import { getAuthorizedBulkStats } from '@/lib/authorizedBulkStats';

/**
 * Find which usernames from the failed list are covered by the supplied
 * credential rows. Returns matched + missing for the UI to surface gaps.
 */
export function matchHealCandidates(failedUsernames, suppliedRows) {
  const supplied = new Map();
  for (const row of suppliedRows || []) {
    const u = String(row.username || row.email || '').trim();
    const p = String(row.password || '').trim();
    if (u && p) supplied.set(u, p);
  }
  const matched = [];
  const missing = [];
  for (const username of failedUsernames) {
    if (supplied.has(username)) matched.push({ username, password: supplied.get(username) });
    else missing.push(username);
  }
  return { matched, missing };
}

/**
 * Run a heal pass over the given matched rows using the parent run's
 * exact selectors + URL, then persist a child run record.
 */
export async function autoHealRun({ parentRun, matched, concurrency = 2, selectorConfig, onRowUpdate, shouldAbort }) {
  if (!parentRun) throw new Error('Parent run is required');
  if (!matched?.length) throw new Error('No matched credentials to heal');

  const config = {
    targetUrl: parentRun.targetUrl,
    usernameSelector: selectorConfig?.usernameSelector || parentRun.usernameSelector,
    passwordSelector: selectorConfig?.passwordSelector || parentRun.passwordSelector,
    submitSelector: selectorConfig?.submitSelector || parentRun.submitSelector,
  };

  const rows = matched.map((m, i) => ({ index: i, username: m.username, password: m.password }));
  const results = rows.map((r) => ({
    index: r.index,
    username: r.username,
    status: 'queued',
    outcome: 'Queued',
    startedAt: null,
    endedAt: null,
  }));
  const resultsByIndex = new Map(results.map((r) => [r.index, r]));

  const childStartedAt = new Date().toISOString();
  const child = await base44.entities.AuthorizedBulkQARun.create({
    targetUrl: parentRun.targetUrl,
    targetHost: parentRun.targetHost,
    usernameSelector: config.usernameSelector,
    passwordSelector: config.passwordSelector,
    submitSelector: config.submitSelector,
    status: 'running',
    totalRows: rows.length,
    concurrency,
    results,
    parentRunId: parentRun.id,
    isHealRun: true,
    startedAt: childStartedAt,
  });

  const runId = `heal-${child.id}`;

  const persist = async (status) => {
    const list = Array.from(resultsByIndex.values());
    const stats = getAuthorizedBulkStats(list);
    await base44.entities.AuthorizedBulkQARun.update(child.id, {
      results: list,
      passedCount: stats.passed || 0,
      reviewCount: stats.review || 0,
      failedCount: stats.failed || 0,
      status,
      ...(status !== 'running' ? { completedAt: new Date().toISOString() } : {}),
    });
  };

  try {
    await runAuthorizedBulkQA({
      rows,
      config,
      concurrency,
      runId,
      shouldAbort,
      onRowUpdate: (patch) => {
        const existing = resultsByIndex.get(patch.index) || {};
        const merged = { ...existing, ...patch };
        resultsByIndex.set(patch.index, merged);
        onRowUpdate?.(merged);
      },
    });
    await persist(shouldAbort?.() ? 'stopped' : 'completed');
  } catch (error) {
    await persist('failed');
    throw error;
  }

  return child.id;
}