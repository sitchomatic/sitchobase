/**
 * Failure pattern classifier.
 *
 * Pure function: given a free-text failure message (the `details` field on
 * JoeIgniteRun, the per-row `outcome` on AuthorizedBulkQARun, or the
 * `error_summary` on a monitoringLog entry) it returns one of the
 * canonical pattern objects below.
 *
 * Adding a new pattern? Append to PATTERNS — order matters (first match wins).
 */

export const PATTERN_KINDS = {
  CAPTCHA: 'captcha',
  SITE_UPDATE: 'site_update',
  ACCOUNT_LOCKED: 'account_locked',
  AUTH_REJECTED: 'auth_rejected',
  PROXY_BAN: 'proxy_ban',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  CIRCUIT_BREAKER: 'circuit_breaker',
  UPSTREAM_5XX: 'upstream_5xx',
  UNKNOWN: 'unknown',
};

const PATTERNS = [
  {
    kind: PATTERN_KINDS.CAPTCHA,
    label: 'CAPTCHA challenge',
    icon: 'ShieldAlert',
    color: 'amber',
    test: /captcha|recaptcha|hcaptcha|cloudflare challenge|cf[- _]chl|are you a human|verify you are human/i,
  },
  {
    kind: PATTERN_KINDS.ACCOUNT_LOCKED,
    label: 'Account lock / temp ban',
    icon: 'Lock',
    color: 'red',
    test: /temp[_ -]?lock|temporarily locked|account locked|too many attempts|account suspended|disabled by admin|perm[_ -]?ban/i,
  },
  {
    kind: PATTERN_KINDS.AUTH_REJECTED,
    label: 'Auth rejected (bad credentials)',
    icon: 'KeyRound',
    color: 'red',
    test: /invalid (login|password|credentials)|incorrect (password|username)|authentication failed|status code 401|\b401\b|unauthorized|no_account|wrong password/i,
  },
  {
    kind: PATTERN_KINDS.SITE_UPDATE,
    label: 'Site changed (selector / form drift)',
    icon: 'AlertTriangle',
    color: 'amber',
    test: /selector .* not found|element not found|locator.*failed|waitfor.*timed out|no such element|form.*changed|field .* missing|status code 400/i,
  },
  {
    kind: PATTERN_KINDS.PROXY_BAN,
    label: 'Proxy / IP blocked',
    icon: 'Shield',
    color: 'red',
    test: /access denied|forbidden|status code 403|\b403\b|geo[- ]?block|ip (blocked|banned)|country.*not allowed|proxy.*(blocked|banned|denied)/i,
  },
  {
    kind: PATTERN_KINDS.RATE_LIMIT,
    label: 'Rate-limited',
    icon: 'Gauge',
    color: 'amber',
    test: /rate.?limit|too many requests|status code 429|\b429\b|throttl/i,
  },
  {
    kind: PATTERN_KINDS.TIMEOUT,
    label: 'Timeout',
    icon: 'Clock',
    color: 'amber',
    test: /timed? ?out|timeout|deadline exceeded|status code 408|status code 504/i,
  },
  {
    kind: PATTERN_KINDS.CIRCUIT_BREAKER,
    label: 'Circuit breaker open',
    icon: 'Zap',
    color: 'red',
    test: /circuit breaker (is )?open|breaker tripped/i,
  },
  {
    kind: PATTERN_KINDS.NETWORK,
    label: 'Network / DNS',
    icon: 'WifiOff',
    color: 'red',
    test: /enotfound|econnreset|econnrefused|fetch failed|network error|getaddrinfo|socket hang up|tunnel.*failed/i,
  },
  {
    kind: PATTERN_KINDS.UPSTREAM_5XX,
    label: 'Provider error (5xx)',
    icon: 'ServerCrash',
    color: 'red',
    test: /status code 5\d\d|\b5\d\d\b.*(error|server)|bad gateway|service unavailable|gateway timeout/i,
  },
];

/**
 * Classify a single message string. Always returns a pattern (UNKNOWN for
 * messages that match none).
 */
export function classify(message) {
  const text = String(message || '').trim();
  if (!text) return { kind: PATTERN_KINDS.UNKNOWN, label: 'Unknown', icon: 'HelpCircle', color: 'gray' };
  for (const p of PATTERNS) if (p.test.test(text)) return { kind: p.kind, label: p.label, icon: p.icon, color: p.color };
  return { kind: PATTERN_KINDS.UNKNOWN, label: 'Unknown / unclassified', icon: 'HelpCircle', color: 'gray' };
}

/**
 * Classify a list of failure records, where each record exposes
 * `{ id, source, message, ...rest }`. Returns clusters grouped by pattern
 * with sorted descending count.
 */
export function clusterFailures(records) {
  const buckets = new Map();
  for (const rec of records) {
    const p = classify(rec.message);
    const bucket = buckets.get(p.kind) || { ...p, items: [] };
    bucket.items.push(rec);
    buckets.set(p.kind, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.items.length - a.items.length);
}