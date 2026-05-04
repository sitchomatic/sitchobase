const USERNAME_FALLBACK = 'input[type="email"], input[name*="email" i], input[name*="user" i], input[id*="email" i], input[id*="user" i], input[autocomplete="username"]';
const PASSWORD_FALLBACK = 'input[type="password"], input[name*="pass" i], input[id*="pass" i], input[autocomplete="current-password"]';
const SUBMIT_FALLBACK = 'button[type="submit"], input[type="submit"], button[name*="login" i], button[id*="login" i], button[id*="submit" i], [role="button"]';

function isSelectorFailure(row) {
  const text = `${row?.outcome || ''} ${row?.failureType || ''}`.toLowerCase();
  return text.includes('selector') || text.includes('form controls') || text.includes('not found') || text.includes('could not be used');
}

export function buildSelectorRemediationDefaults(parentRun) {
  return {
    usernameSelector: parentRun?.usernameSelector || 'input[name="email"]',
    passwordSelector: parentRun?.passwordSelector || 'input[type="password"]',
    submitSelector: parentRun?.submitSelector || 'button[type="submit"]',
  };
}

export function getSelectorAdjustmentSuggestions(parentRun, failedRows = []) {
  const selectorFailures = failedRows.filter(isSelectorFailure);
  const affectedCount = selectorFailures.length || failedRows.length;
  const baseReason = selectorFailures.length
    ? `${selectorFailures.length} selected failure${selectorFailures.length !== 1 ? 's' : ''} mention missing or unusable selectors.`
    : 'Use broader selectors to handle target markup changes before re-running the failed subset.';

  return [
    {
      field: 'usernameSelector',
      label: 'Username selector',
      current: parentRun?.usernameSelector || '',
      suggested: USERNAME_FALLBACK,
      reason: baseReason,
      affectedCount,
    },
    {
      field: 'passwordSelector',
      label: 'Password selector',
      current: parentRun?.passwordSelector || '',
      suggested: PASSWORD_FALLBACK,
      reason: 'Password inputs often keep type="password" but rename id/name attributes.',
      affectedCount,
    },
    {
      field: 'submitSelector',
      label: 'Submit selector',
      current: parentRun?.submitSelector || '',
      suggested: SUBMIT_FALLBACK,
      reason: 'Submit controls commonly change between button, input, or role-based elements.',
      affectedCount,
    },
  ];
}