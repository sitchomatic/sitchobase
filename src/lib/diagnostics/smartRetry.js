/**
 * Smart Retry — re-run a single failed AuthorizedBulkQA row with the
 * operator's chosen swap (different proxy, different credential, or both).
 *
 * Returns a Promise that resolves to the final row patch.
 */
import { runAuthorizedBulkQA } from '@/lib/authorizedBulkRunner';
import { auditLog } from '@/lib/auditLog';

export async function smartRetryAuthorizedBulkRow({ run, row, swap }) {
  if (!run || !row) throw new Error('Missing run or row for smart retry');

  const retryRow = {
    index: row.index,
    username: swap.credential?.email || row.username,
    password: swap.credential?.password || row.password || '',
  };

  let lastPatch = null;
  await runAuthorizedBulkQA({
    rows: [retryRow],
    concurrency: 1,
    config: {
      targetUrl: run.targetUrl,
      usernameSelector: run.usernameSelector || 'input[name="email"]',
      passwordSelector: run.passwordSelector || 'input[type="password"]',
      submitSelector: run.submitSelector || 'button[type="submit"]',
    },
    runId: run.id,
    onRowUpdate: (patch) => { lastPatch = patch; },
  });

  auditLog({
    action: 'DIAGNOSTICS_SMART_RETRY',
    category: 'bulk',
    targetId: run.id,
    details: {
      runId: run.id,
      rowIndex: row.index,
      swappedProxy: swap.proxy?.id || null,
      swappedCredential: swap.credential?.id || null,
      result: lastPatch?.status || 'unknown',
    },
    status: lastPatch?.status === 'passed' ? 'success' : 'failure',
  });

  return lastPatch;
}