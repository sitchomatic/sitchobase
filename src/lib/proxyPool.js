/**
 * Proxy pool helpers — fetch enabled proxies from ProxyPool entity and
 * hand them out round-robin. Index is persisted in localStorage so rotation
 * continues across batches.
 */
import { base44 } from '@/api/base44Client';

const INDEX_KEY = 'joe_ignite_proxy_index';

export async function fetchEnabledProxies() {
  const all = await base44.entities.ProxyPool.list('-created_date', 500);
  return all.filter((p) => p.enabled !== false && p.server);
}

/** Convert a ProxyPool record to Browserbase external-proxy config. */
export function toBrowserbaseProxy(p) {
  const proxy = { type: 'external', server: p.server };
  if (p.username) proxy.username = p.username;
  if (p.password) proxy.password = p.password;
  return proxy;
}

/** Produce a round-robin picker over a proxy array, persisting the cursor. */
export function createRoundRobinPicker(proxies) {
  let cursor = Number(localStorage.getItem(INDEX_KEY) || 0);
  if (proxies.length === 0) return () => null;
  return () => {
    const proxy = proxies[cursor % proxies.length];
    cursor = (cursor + 1) % proxies.length;
    localStorage.setItem(INDEX_KEY, String(cursor));
    return proxy;
  };
}

/**
 * Parse free-form proxy list text. Accepts either:
 *   host:port:user:pass
 *   host:port
 *   user:pass@host:port
 * one per line. Returns array of ProxyPool-shaped records.
 */
export function parseProxyList(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    // user:pass@host:port
    const atMatch = line.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/);
    if (atMatch) {
      out.push({ username: atMatch[1], password: atMatch[2], server: `${atMatch[3]}:${atMatch[4]}`, enabled: true });
      continue;
    }
    const parts = line.split(':');
    if (parts.length === 4) {
      out.push({ server: `${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3], enabled: true });
    } else if (parts.length === 2) {
      out.push({ server: `${parts[0]}:${parts[1]}`, enabled: true });
    }
  }
  return out;
}