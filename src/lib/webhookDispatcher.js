/**
 * webhookDispatcher — fires outbound webhooks for bulk QA lifecycle events.
 *
 * Loads enabled WebhookConfig records, filters by event type, POSTs a JSON
 * payload, and records lastFiredAt / lastStatus / lastError on success or
 * failure. Best-effort: failures never throw to the caller — bulk QA runs
 * must complete cleanly even if a webhook endpoint is down.
 *
 * Supported events:
 *   - bulk_run_completed    → run finished (any status)
 *   - bulk_run_failed       → run finished with failed/stopped status
 *   - consecutive_error_threshold → N consecutive rows failed mid-run
 */
import { base44 } from '@/api/base44Client';

let configsCache = null;
let configsCacheAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadConfigs() {
  if (configsCache && Date.now() - configsCacheAt < CACHE_TTL_MS) return configsCache;
  try {
    const data = await base44.entities.WebhookConfig.list('-updated_date', 50);
    configsCache = Array.isArray(data) ? data : [];
    configsCacheAt = Date.now();
    return configsCache;
  } catch {
    // Entity not deployed or list failed — silently skip.
    return [];
  }
}

export function invalidateWebhookCache() {
  configsCache = null;
  configsCacheAt = 0;
}

async function deliver(config, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.secret) headers['X-Webhook-Secret'] = config.secret;

  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(config.url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timer);
    const status = `${res.status} ${res.statusText || ''}`.trim();
    if (!res.ok) {
      await base44.entities.WebhookConfig.update(config.id, { lastStatus: status, lastError: `HTTP ${res.status}` }).catch(() => {});
      return { ok: false, status };
    }
    await base44.entities.WebhookConfig.update(config.id, {
      lastFiredAt: new Date().toISOString(),
      lastStatus: status,
      lastError: '',
    }).catch(() => {});
    return { ok: true, status };
  } catch (err) {
    clearTimeout(timer);
    const message = err?.name === 'AbortError' ? 'Request timed out (10s)' : (err?.message || 'fetch failed');
    await base44.entities.WebhookConfig.update(config.id, { lastStatus: 'error', lastError: message }).catch(() => {});
    return { ok: false, status: 'error', error: message };
  }
}

export async function dispatchWebhookEvent(eventType, payload) {
  const configs = await loadConfigs();
  const matches = configs.filter((c) => c.enabled !== false && Array.isArray(c.events) && c.events.includes(eventType));
  if (matches.length === 0) return [];

  const fullPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const results = await Promise.all(matches.map((config) => deliver(config, fullPayload)));
  invalidateWebhookCache();
  return results;
}

/**
 * Pings a webhook config without persisting the run-time payload — used by the
 * "Send test" button in the settings panel.
 */
export async function sendTestWebhook(config) {
  return deliver(config, {
    event: 'test',
    timestamp: new Date().toISOString(),
    message: 'This is a test event from BB Command Center.',
  });
}