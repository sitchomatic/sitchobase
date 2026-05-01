/**
 * Map a failure pattern to a concrete remediation plan: which lever to
 * pull (proxy / credential / config), why, and a route the user can click
 * to enact it.
 */
import { PATTERN_KINDS } from './patterns';

export function suggestRemediation(kind, ctx = {}) {
  const { proxyHealthy = 0, credentialsAvailable = 0 } = ctx;

  switch (kind) {
    case PATTERN_KINDS.CAPTCHA:
      return {
        action: 'Swap to residential premium proxy + slower run',
        why: 'CAPTCHA challenges fire on data-center IPs and high request rates. Use a residential / premium proxy and reduce concurrency.',
        swap: 'proxy',
        ctaLabel: proxyHealthy > 0 ? `Pick from ${proxyHealthy} healthy proxies` : 'Open proxy pool',
        ctaTo: '/proxies',
      };
    case PATTERN_KINDS.PROXY_BAN:
      return {
        action: 'Quarantine current proxy & rotate to a healthy one',
        why: '403 / geo-block / IP-banned responses indicate the proxy itself is on a blocklist. Rotate before the rest of the pool gets flagged.',
        swap: 'proxy',
        ctaLabel: proxyHealthy > 0 ? `Rotate to ${proxyHealthy} healthy proxies` : 'Open proxy pool',
        ctaTo: '/proxies',
      };
    case PATTERN_KINDS.RATE_LIMIT:
      return {
        action: 'Reduce concurrency and rotate proxies',
        why: '429 / Too Many Requests means the IP exceeded the provider limit. Drop concurrency and spread load across more proxies.',
        swap: 'proxy',
        ctaLabel: 'Open proxy pool',
        ctaTo: '/proxies',
      };
    case PATTERN_KINDS.ACCOUNT_LOCKED:
      return {
        action: 'Mark account burned & swap to a fresh credential',
        why: 'A temporary or permanent lock means the account is unusable for now. Burn it so retries do not waste runs on it.',
        swap: 'credential',
        ctaLabel: credentialsAvailable > 0 ? `Pick from ${credentialsAvailable} non-burned credentials` : 'Open credentials',
        ctaTo: '/au-casino/credentials',
      };
    case PATTERN_KINDS.AUTH_REJECTED:
      return {
        action: 'Try previous password or rotate to another credential',
        why: 'Auth rejection is usually a stale / rotated password. Try the stored previousPassword first, then swap to a different credential.',
        swap: 'credential',
        ctaLabel: credentialsAvailable > 0 ? `Pick from ${credentialsAvailable} non-burned credentials` : 'Open credentials',
        ctaTo: '/au-casino/credentials',
      };
    case PATTERN_KINDS.SITE_UPDATE:
      return {
        action: 'Update selectors in the script / Cloud Function',
        why: 'Selector / form drift means the target site changed. The script needs new locators; no proxy or credential swap will fix this.',
        swap: 'config',
        ctaLabel: 'Open Cloud Functions',
        ctaTo: '/stagehand',
      };
    case PATTERN_KINDS.CIRCUIT_BREAKER:
      return {
        action: 'Wait for breaker to close, then re-test Browserbase',
        why: 'The bbProxy circuit breaker tripped after consecutive upstream errors. New runs are blocked until it auto-resets.',
        swap: 'config',
        ctaLabel: 'Test API health',
        ctaTo: '/health',
      };
    case PATTERN_KINDS.TIMEOUT:
      return {
        action: 'Increase per-step timeout and retry on a faster proxy',
        why: 'Timeouts are typically slow proxies or network congestion. Try a different proxy region.',
        swap: 'proxy',
        ctaLabel: 'Open proxy pool',
        ctaTo: '/proxies',
      };
    case PATTERN_KINDS.NETWORK:
      return {
        action: 'Re-test connectivity & switch proxy provider',
        why: 'DNS / connection-reset errors point at the proxy or upstream provider being unreachable.',
        swap: 'proxy',
        ctaLabel: 'Run Browser Monitoring health checks',
        ctaTo: '/monitoring',
      };
    case PATTERN_KINDS.UPSTREAM_5XX:
      return {
        action: 'Wait & retry — provider-side issue',
        why: '5xx responses are upstream provider problems. Retrying immediately rarely helps; check provider status pages.',
        swap: 'config',
        ctaLabel: 'Open Browser Monitoring',
        ctaTo: '/monitoring',
      };
    default:
      return {
        action: 'Inspect the raw error and decide manually',
        why: 'No pattern matched — this is unclassified.',
        swap: 'manual',
        ctaLabel: 'Open audit log',
        ctaTo: '/audit',
      };
  }
}