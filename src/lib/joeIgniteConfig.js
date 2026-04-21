/**
 * Joe Ignite Testing — shared config mirroring the original Stagehand script.
 * Edit selectors / URLs here and every worker picks them up.
 */
export const JOE_IGNITE_CONFIG = {
  MAX_ATTEMPTS: 4,
  USE_PARALLEL_SITES: true,
  DEFAULT_CONCURRENCY: 4,
  POST_SUBMIT_WAIT_FIRST_MS: 7000,  // max wait for first login press (site can delay up to ~6.5s)
  POST_SUBMIT_WAIT_RETRY_MS: 3000,  // shorter cap on attempts 2-4 — site is already warm
  POST_SUBMIT_POLL_MS: 200,         // how often we re-check the DOM during that wait (fast poll to catch the success banner ASAP)

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
 * Classify the outcome of a single login attempt.
 * Rules from the user's real-world experience with Joe Fortune / Ignition:
 *   - "temporarily disabled" (exact phrase) → TEMP_LOCK
 *   - "has been disabled"    (exact phrase) → PERM_BAN
 *   - "incorrect"            (any variant)  → CONTINUE (bad attempt, try again)
 *   - success banner detected              → SUCCESS
 *   - nothing yet                          → CONTINUE
 *
 * NO_ACCOUNT is NOT decided per-attempt — it's only assigned AFTER all
 * MAX_ATTEMPTS have returned CONTINUE (i.e. only "incorrect" responses).
 * That's because a real account would have been temp-locked by attempt 4.
 */
export function classifyOutcome({ url = '', text = '', successBanner = false }) {
  const u = (url || '').toLowerCase();
  const t = (text || '').toLowerCase();

  // Explicit success signals
  if (successBanner) return 'SUCCESS';
  if (u.includes('/account') || u.includes('/lobby') || u.includes('/dashboard') ||
      t.includes('logout') || t.includes('sign out') || t.includes('my account')) {
    return 'SUCCESS';
  }

  // Exact phrases from the sites
  if (t.includes('temporarily disabled')) return 'TEMP_LOCK';
  if (t.includes('has been disabled'))    return 'PERM_BAN';

  // Bad credentials response → keep trying
  if (t.includes('incorrect')) return 'CONTINUE';

  return 'CONTINUE';
}

/**
 * Final bucket for a credential after all attempts across both sites.
 * Terminal signals (SUCCESS / lock / ban) win immediately.
 * If every attempt only ever returned "incorrect" (CONTINUE) → NO_ACCOUNT.
 */
export function finalOutcomeFromResults({ joe, ignition }) {
  const values = [joe, ignition];
  if (values.includes('SUCCESS'))   return 'SUCCESS';
  if (values.includes('PERM_BAN'))  return 'PERM_BAN';
  if (values.includes('TEMP_LOCK')) return 'TEMP_LOCK';
  if (values.every((v) => v === 'ERROR')) return 'ERROR';
  // Both sites only ever said "incorrect" across all attempts → no account exists on either
  return 'NO_ACCOUNT';
}