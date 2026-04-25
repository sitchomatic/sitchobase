const HOST_RE = /^(\[[a-f0-9:]+\]|[a-z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3})$/i;
const ROTATION_KEY = 'proxy_rotation_failover_state_v2';

export function normalizeProxyServer(server) {
  const raw = String(server || '').trim().replace(/^https?:\/\//i, '').replace(/^socks5?:\/\//i, '');
  const withoutPath = raw.split('/')[0];
  const ipv6 = withoutPath.match(/^(\[[^\]]+\]):(\d+)$/);
  const normal = ipv6 ? `${ipv6[1].toLowerCase()}:${ipv6[2]}` : withoutPath.toLowerCase();
  return normal;
}

export function validateProxyRecord(proxy) {
  const server = normalizeProxyServer(proxy?.server);
  const lastColon = server.lastIndexOf(':');
  if (lastColon <= 0) return { ok: false, reason: 'Missing host or port' };

  const host = server.slice(0, lastColon);
  const port = Number(server.slice(lastColon + 1));
  if (!HOST_RE.test(host)) return { ok: false, reason: 'Invalid host' };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, reason: 'Invalid port' };
  if ((proxy.username && !proxy.password) || (!proxy.username && proxy.password)) return { ok: false, reason: 'Incomplete auth pair' };

  return { ok: true, server };
}

export function proxyFingerprint(proxy) {
  return [normalizeProxyServer(proxy.server), proxy.username || '', proxy.password || ''].join('|');
}

export function dedupeAndValidateProxies(list) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const proxy of list) {
    const checked = validateProxyRecord(proxy);
    if (!checked.ok) {
      rejected.push({ proxy, reason: checked.reason });
      continue;
    }
    const clean = { ...proxy, server: checked.server };
    const fp = proxyFingerprint(clean);
    if (seen.has(fp)) {
      rejected.push({ proxy: clean, reason: 'Duplicate proxy' });
      continue;
    }
    seen.add(fp);
    valid.push({
      ...clean,
      enabled: clean.enabled !== false,
      healthStatus: clean.healthStatus || 'unknown',
      consecutiveFailures: Number(clean.consecutiveFailures || 0),
    });
  }

  return { valid, rejected };
}

export function isProxyQuarantined(proxy, now = Date.now()) {
  return proxy?.quarantineUntil && new Date(proxy.quarantineUntil).getTime() > now;
}

export function getProxyScore(proxy) {
  const used = Number(proxy.timesUsed || 0);
  const success = Number(proxy.successCount || 0);
  const failure = Number(proxy.failureCount || 0);
  const latency = Number(proxy.latencyMs || 0);
  const failStreak = Number(proxy.consecutiveFailures || 0);
  const successRate = used > 0 ? success / Math.max(1, success + failure) : 0.5;
  const latencyPenalty = latency > 0 ? Math.min(0.35, latency / 30000) : 0;
  const streakPenalty = Math.min(0.5, failStreak * 0.12);
  const quarantinePenalty = isProxyQuarantined(proxy) ? 2 : 0;
  return successRate - latencyPenalty - streakPenalty - quarantinePenalty;
}

function readRotationState() {
  try {
    return JSON.parse(localStorage.getItem(ROTATION_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeRotationState(state) {
  localStorage.setItem(ROTATION_KEY, JSON.stringify(state));
}

export function createHealingProxyPicker(proxies) {
  const eligible = proxies
    .filter((proxy) => proxy.enabled !== false && proxy.server && !isProxyQuarantined(proxy))
    .sort((a, b) => getProxyScore(b) - getProxyScore(a));

  if (!eligible.length) return () => null;

  const state = readRotationState();
  let cursor = Number(state.cursor || 0) % eligible.length;

  return () => {
    const proxy = eligible[cursor % eligible.length];
    cursor = (cursor + 1) % eligible.length;
    writeRotationState({ cursor, updatedAt: new Date().toISOString() });
    return proxy;
  };
}

export function nextQuarantineUntil(consecutiveFailures = 1) {
  const minutes = Math.min(60, Math.max(5, consecutiveFailures * consecutiveFailures * 5));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}