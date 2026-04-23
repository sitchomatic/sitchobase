/**
 * Infer a proxy provider name from a ProxyPool record.
 * Used for grouping proxies in the Efficiency dashboard.
 *
 * Priority:
 *   1. Explicit host match against known providers
 *   2. Label prefix (up to first space / dash)
 *   3. 'unknown'
 */
const KNOWN_PROVIDERS = [
  { match: /smartproxy|smartdaili/i,    name: 'smartproxy' },
  { match: /brd\.superproxy|brightdata/i, name: 'brightdata' },
  { match: /oxylabs/i,                   name: 'oxylabs' },
  { match: /iproyal/i,                   name: 'iproyal' },
  { match: /soax/i,                      name: 'soax' },
  { match: /packetstream/i,              name: 'packetstream' },
  { match: /nimbleway/i,                 name: 'nimbleway' },
  { match: /netnut/i,                    name: 'netnut' },
  { match: /webshare/i,                  name: 'webshare' },
  { match: /proxymesh/i,                 name: 'proxymesh' },
  { match: /stormproxies/i,              name: 'stormproxies' },
];

/**
 * Returns a stable provider slug for a ProxyPool record, a string like
 * 'bb-au' for Browserbase built-in, or 'none' if no proxy was used.
 */
export function inferProxyProvider(proxy) {
  if (!proxy) return 'none';
  if (proxy === 'bb-au') return 'bb-au';
  if (typeof proxy === 'string') return proxy;

  const haystack = `${proxy.server || ''} ${proxy.label || ''}`.toLowerCase();
  for (const { match, name } of KNOWN_PROVIDERS) {
    if (match.test(haystack)) return name;
  }

  // Fallback: first token of label, else host root
  if (proxy.label) {
    const first = proxy.label.split(/[\s-_]/)[0].toLowerCase();
    if (first) return first;
  }
  if (proxy.server) {
    const host = proxy.server.split(':')[0];
    // Keep the registrable-ish part: last two labels, e.g. smartproxy.com
    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join('.').toLowerCase();
    return host.toLowerCase();
  }
  return 'unknown';
}