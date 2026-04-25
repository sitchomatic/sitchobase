import { base44 } from '@/api/base44Client';

function summarize(rows) {
  return {
    passedCount: rows.filter((row) => row.status === 'passed').length,
    reviewCount: rows.filter((row) => row.status === 'review').length,
    failedCount: rows.filter((row) => row.status === 'failed').length,
  };
}

export function sanitizeAuthorizedBulkResults(rows) {
  return rows.map(({ index, username, status, outcome, sessionId, finalUrl, pageTitle, startedAt, endedAt }) => ({
    index,
    username,
    status,
    outcome,
    sessionId,
    finalUrl,
    pageTitle,
    startedAt,
    endedAt,
  }));
}

export async function createAuthorizedBulkRun({ targetUrl, concurrency, rows }) {
  const targetHost = new URL(targetUrl).host;
  const startedAt = new Date().toISOString();
  return base44.entities.AuthorizedBulkQARun.create({
    targetUrl,
    targetHost,
    status: 'running',
    totalRows: rows.length,
    concurrency,
    results: sanitizeAuthorizedBulkResults(rows),
    startedAt,
  });
}

export async function updateAuthorizedBulkRun(runId, rows, status = 'running') {
  if (!runId) return;
  const completed = ['completed', 'stopped', 'failed'].includes(status);
  await base44.entities.AuthorizedBulkQARun.update(runId, {
    status,
    ...summarize(rows),
    results: sanitizeAuthorizedBulkResults(rows),
    ...(completed ? { completedAt: new Date().toISOString() } : {}),
  });
}