/**
 * pingProxies — lightweight latency probe for the Proxy Health dashboard.
 *
 * Unlike `proxyNetworkHeal` (which validates, dedupes, quarantines, and
 * persists outcomes), this function ONLY measures end-to-end latency by
 * spinning up short Browserbase sessions through each proxy and times
 * the round-trip. It does not mutate ProxyPool records — the dashboard
 * uses these readings to decide what to highlight; the existing
 * `proxyNetworkHeal` is the actor that persists health changes.
 *
 * Returns: { ok, results: [{ id, label, server, country, ok, latencyMs, error }] }
 *
 * Auth: any signed-in user; reads ProxyPool via service role so the
 * caller doesn't need RLS read access to other users' proxies.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BB_BASE = 'https://api.browserbase.com/v1';
const MAX_PARALLEL = 5;
const PER_PROXY_TIMEOUT_MS = 25_000;

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

async function pingOne({ proxy, projectId, apiKey }) {
  const started = Date.now();
  const externalProxy = { type: 'external', server: proxy.server };
  if (proxy.username) externalProxy.username = proxy.username;
  if (proxy.password) externalProxy.password = proxy.password;

  const session = await Promise.race([
    bbFetch('/sessions', 'POST', apiKey, {
      projectId,
      timeout: 60,
      region: proxy.country === 'AU' ? 'ap-southeast-1' : undefined,
      proxies: [externalProxy],
      browserSettings: { viewport: { width: 390, height: 844 } },
      userMetadata: { launchedFrom: 'BBCommandCenter', task: 'proxy-ping', proxyId: proxy.id },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timed out')), PER_PROXY_TIMEOUT_MS)),
  ]);
  const latencyMs = Date.now() - started;
  if (session?.id) {
    await bbFetch(`/sessions/${session.id}`, 'POST', apiKey, { projectId, status: 'REQUEST_RELEASE' }).catch(() => {});
  }
  return latencyMs;
}

async function runQueue(proxies, worker) {
  const queue = [...proxies];
  const results = [];
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async () => {
    while (queue.length) {
      const proxy = queue.shift();
      if (!proxy) return;
      results.push(await worker(proxy));
    }
  });
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, proxyIds = null, limit = 25 } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('Api_key');
    if (!apiKey) return Response.json({ error: 'Api_key secret not configured' }, { status: 400 });
    if (!projectId) return Response.json({ error: 'Project ID is required' }, { status: 400 });

    const all = await base44.asServiceRole.entities.ProxyPool.list('-created_date', 1000);
    let candidates = all.filter((p) => p.enabled !== false && p.server);
    if (Array.isArray(proxyIds) && proxyIds.length) {
      candidates = candidates.filter((p) => proxyIds.includes(p.id));
    }
    candidates = candidates.slice(0, Math.max(1, Math.min(Number(limit) || 25, 50)));

    const results = await runQueue(candidates, async (proxy) => {
      try {
        const latencyMs = await pingOne({ proxy, projectId, apiKey });
        return { id: proxy.id, label: proxy.label || proxy.server, server: proxy.server, country: proxy.country, ok: true, latencyMs };
      } catch (error) {
        return { id: proxy.id, label: proxy.label || proxy.server, server: proxy.server, country: proxy.country, ok: false, error: error.message };
      }
    });

    return Response.json({
      ok: true,
      total: candidates.length,
      results,
      pingedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});