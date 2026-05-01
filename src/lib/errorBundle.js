/**
 * Builds a single, copy-paste-ready JSON bundle that contains everything we
 * need to diagnose an issue from a Base44-built app:
 *   - browser/build context
 *   - circuit breaker state
 *   - last N FrontendError records
 *   - last N SlowCall records
 *   - last N failed AuditLog records
 *   - in-memory breadcrumbs (recent navigations + console errors)
 *
 * The bundle is intentionally bounded in size (default 200 of each entity,
 * 4kB stack truncation) so it stays small enough to paste back into chat.
 */
import { base44 } from '@/api/base44Client';
import { getCircuitState } from '@/lib/bbClient';
import { getBreadcrumbs } from '@/lib/errorBreadcrumbs';
import { downloadFile } from '@/lib/csvExport';

const APP_VERSION = (typeof globalThis !== 'undefined' && globalThis.__APP_VERSION__) || 'dev';

function safeList(entityName, ...args) {
  // Each entity has different RLS — non-admins can only read their own
  // FrontendError/SlowCall rows, so we tolerate empty results rather than
  // failing the whole bundle.
  try {
    return base44.entities[entityName].list(...args).catch(() => []);
  } catch {
    return Promise.resolve([]);
  }
}

function truncate(str, n) {
  if (typeof str !== 'string') return str;
  return str.length > n ? `${str.slice(0, n)}…[truncated ${str.length - n} chars]` : str;
}

function trimError(e) {
  if (!e) return e;
  return {
    ...e,
    stack: truncate(e.stack || '', 4000),
    message: truncate(e.message || '', 1000),
  };
}

export async function buildErrorBundle({ limit = 200 } = {}) {
  const [frontendErrors, slowCalls, auditFailures] = await Promise.all([
    safeList('FrontendError', '-created_date', limit),
    safeList('SlowCall', '-created_date', limit),
    base44.entities.AuditLog.filter({ status: 'failure' }, '-created_date', limit).catch(() => []),
  ]);

  const me = await base44.auth.me().catch(() => null);

  return {
    schema: 'base44.error-bundle.v1',
    generatedAt: new Date().toISOString(),
    app: {
      version: APP_VERSION,
      url: typeof window !== 'undefined' ? window.location.href : '',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
    },
    runtime: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      viewport: typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    user: me ? { id: me.id, email: me.email, role: me.role } : null,
    circuitBreaker: getCircuitState(),
    counts: {
      frontendErrors: frontendErrors.length,
      slowCalls: slowCalls.length,
      auditFailures: auditFailures.length,
    },
    breadcrumbs: getBreadcrumbs(),
    frontendErrors: frontendErrors.map(trimError),
    slowCalls,
    auditFailures,
  };
}

export async function downloadErrorBundle(opts) {
  const bundle = await buildErrorBundle(opts);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadFile(`base44-error-bundle-${stamp}.json`, JSON.stringify(bundle, null, 2), 'application/json');
  return bundle;
}

export async function copyErrorBundle(opts) {
  const bundle = await buildErrorBundle(opts);
  const json = JSON.stringify(bundle, null, 2);
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(json);
  }
  return { bundle, size: json.length };
}