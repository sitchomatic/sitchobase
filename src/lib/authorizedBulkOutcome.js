const ERROR_PATTERNS = [
  /invalid/i,
  /incorrect/i,
  /wrong/i,
  /failed/i,
  /error/i,
  /locked/i,
  /disabled/i,
  /try again/i,
];

const SUCCESS_PATTERNS = [
  /dashboard/i,
  /account/i,
  /profile/i,
  /logout/i,
  /sign out/i,
  /welcome/i,
];

export function classifyAuthorizedBulkOutcome({ beforeUrl, afterUrl, title = '', text = '' }) {
  const body = `${title}\n${text}`.slice(0, 1500);
  const changedUrl = Boolean(afterUrl && beforeUrl && afterUrl !== beforeUrl);

  if (changedUrl || SUCCESS_PATTERNS.some((pattern) => pattern.test(body))) {
    return {
      status: 'passed',
      outcome: changedUrl ? 'Navigation changed after submit' : 'Success signal detected after submit',
    };
  }

  if (ERROR_PATTERNS.some((pattern) => pattern.test(body))) {
    return {
      status: 'review',
      outcome: 'Submitted and page showed an error-like message; review expected behavior',
    };
  }

  return {
    status: 'review',
    outcome: 'Submitted without a clear success signal; manual review recommended',
  };
}