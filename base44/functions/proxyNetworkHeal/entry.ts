import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const HOST_RE = /^(\[[a-f0-9:]+\]|[a-z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3})$/i;

function normalizeProxyServer(server) {
  return String(server || '').trim().replace(/^https?:\/\//i, '').replace(/^socks5?:\/\//i, '').split('/')[0].toLowerCase();
}

function validateProxy(proxy) {
  const server = normalizeProxyServer(proxy.server);
  const lastColon = server.lastIndexOf(':');
  if (lastColon <= 0) return { ok: false, server, reason: 'Missing host or port' };
  const host = server.slice(0, lastColon);
  const port = Number(server.slice(lastColon + 1));
  if (!HOST_RE.test(host)) return { ok: false, server, reason: 'Invalid host' };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, server, reason: 'Invalid port' };
  if ((proxy.username && !proxy.password) || (!proxy.username && proxy.password)) return { ok: false, server, reason: 'Incomplete auth pair' };
  return { ok: true, server };
}

function fingerprint(proxy) {
  return [normalizeProxyServer(proxy.server), proxy.username || '', proxy.password || ''].join('|');
}

function quarantineUntil(failures) {
  const mins = Math.min(120, Math.max(10, failures * failures * 5));
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

async function bbFetch(path, method, apiKey, body) {
  const res = await fetch(`${BB_BASE}${path}`, {
    method,
    headers: { 'X-BB-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Browserbase ${res.status}: ${text.slice(0, 180)}`);
  return data;
}

async function testProxyWithBrowserbase({ proxy, projectId, apiKey }) {
  const started = Date.now();
  const externalProxy = { type: 'external', server: proxy.server };
  if (proxy.username) externalProxy.username = proxy.username;
  if (proxy.password) externalProxy.password = proxy.password;

  const session = await bbFetch('/sessions', 'POST', apiKey, {
    projectId,
    timeout: 60,
    region: proxy.country === 'AU' ? 'ap-southeast-1' : undefined,
    proxies: [externalProxy],
    browserSettings: { viewport: { width: 390, height: 844 } },
    userMetadata: { launchedFrom: 'BBCommandCenter', task: 'proxy-health-check', proxyId: proxy.id },
  });
  if (session?.id) {
    await bbFetch(`/sessions/${session.id}`, 'POST', apiKey, { projectId, status: 'REQUEST_RELEASE' }).catch(() => {});
  }
  return Date.now() - started;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, testLive = false, limit = 10 } = await req.json();
    const apiKey = Deno.env.get('Api_key');
    if (testLive && !apiKey) return Response.json({ error: 'Api_key secret not configured' }, { status: 400 });
    if (testLive && !projectId) return Response.json({ error: 'Project ID is required for live Browserbase proxy tests' }, { status: 400 });

    const proxies = await base44.asServiceRole.entities.ProxyPool.list('-created_date', 1000);
    const seen = new Map();
    const repaired = [];
    const quarantined = [];
    const released = [];
    const duplicates = [];
    const tested = [];
    const now = Date.now();

    for (const proxy of proxies) {
      const check = validateProxy(proxy);
      if (!check.ok) {
        await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
          enabled: false,
          healthStatus: 'failed',
          lastError: check.reason,
          lastHealthCheckAt: new Date().toISOString(),
        });
        quarantined.push({ id: proxy.id, server: proxy.server, reason: check.reason });
        continue;
      }

      const fp = fingerprint({ ...proxy, server: check.server });
      if (seen.has(fp)) {
        await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
          enabled: false,
          healthStatus: 'quarantined',
          lastError: `Duplicate of ${seen.get(fp)}`,
          quarantineUntil: quarantineUntil(3),
          lastHealthCheckAt: new Date().toISOString(),
        });
        duplicates.push({ id: proxy.id, server: proxy.server });
        continue;
      }
      seen.set(fp, proxy.id);

      if (proxy.server !== check.server) {
        await base44.asServiceRole.entities.ProxyPool.update(proxy.id, { server: check.server });
        repaired.push({ id: proxy.id, from: proxy.server, to: check.server });
      }

      if (proxy.quarantineUntil && new Date(proxy.quarantineUntil).getTime() <= now) {
        await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
          enabled: true,
          healthStatus: 'unknown',
          quarantineUntil: null,
          lastError: '',
          lastHealthCheckAt: new Date().toISOString(),
        });
        released.push({ id: proxy.id, server: check.server });
      }
    }

    if (testLive) {
      const candidates = proxies
        .filter((p) => p.enabled !== false && p.server && !p.quarantineUntil)
        .slice(0, Math.max(1, Math.min(Number(limit) || 10, 25)));

      for (const proxy of candidates) {
        try {
          const latencyMs = await testProxyWithBrowserbase({ proxy, projectId, apiKey });
          await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
            healthStatus: latencyMs < 15000 ? 'healthy' : 'degraded',
            latencyMs,
            consecutiveFailures: 0,
            lastError: '',
            lastHealthCheckAt: new Date().toISOString(),
          });
          tested.push({ id: proxy.id, server: proxy.server, ok: true, latencyMs });
        } catch (error) {
          const failures = Number(proxy.consecutiveFailures || 0) + 1;
          await base44.asServiceRole.entities.ProxyPool.update(proxy.id, {
            healthStatus: failures >= 2 ? 'quarantined' : 'degraded',
            consecutiveFailures: failures,
            failureCount: Number(proxy.failureCount || 0) + 1,
            lastError: error.message,
            quarantineUntil: failures >= 2 ? quarantineUntil(failures) : proxy.quarantineUntil,
            lastHealthCheckAt: new Date().toISOString(),
          });
          tested.push({ id: proxy.id, server: proxy.server, ok: false, error: error.message });
        }
      }
    }

    return Response.json({
      ok: true,
      total: proxies.length,
      repaired,
      duplicates,
      quarantined,
      released,
      tested,
      summary: {
        repaired: repaired.length,
        duplicates: duplicates.length,
        quarantined: quarantined.length,
        released: released.length,
        tested: tested.length,
        healthy: tested.filter((t) => t.ok).length,
        failed: tested.filter((t) => !t.ok).length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});