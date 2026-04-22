/**
 * Live Base44 entity CRUD smoke tests.
 *
 * These tests hit the REAL Base44 backend under api_key auth. They are
 * SKIPPED by default (including in CI) and only run when the developer
 * explicitly opts in with:
 *
 *   VITE_TEST_LIVE_BASE44=true \
 *   VITE_BASE44_APP_ID=... \
 *   VITE_BASE44_APP_BASE_URL=... \
 *   VITE_BASE44_API_KEY=... \
 *   npm run test:run -- base44Client.live
 *
 * Goal: prove that `base44.entities.*` CRUD round-trips actually work end
 * to end against the live app — no mocks, no stubs. Covers the entities
 * surfaced on every core page (Personas, ProxyPool, AuditLog) plus a
 * read-only check on TestReport.
 *
 * Each test creates its records with a unique run tag so concurrent runs
 * don't collide, and deletes what it created in `afterAll`. If a test
 * fails partway through, leftover rows are tagged `devin-live-smoke-*`
 * so you can grep and clean them up manually.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const LIVE = String(import.meta.env?.VITE_TEST_LIVE_BASE44 ?? '').toLowerCase() === 'true';

// Shim a minimal browser-ish window so app-params.js (which the SDK client
// transitively imports) doesn't try to hit `window.location` under Node.
if (typeof globalThis.window === 'undefined') {
  const storage = new Map();
  globalThis.window = {
    location: { search: '', pathname: '/', href: 'http://localhost/', hash: '' },
    history: { replaceState: () => {} },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    document: { title: 'test' },
  };
  globalThis.document = globalThis.window.document;
  globalThis.localStorage = globalThis.window.localStorage;
  globalThis.history = globalThis.window.history;
}

const RUN_TAG = `devin-live-smoke-${Date.now()}`;

describe.skipIf(!LIVE)('base44 live entity CRUD', () => {
  let base44;
  const createdPersonaIds = [];
  const createdProxyIds = [];

  beforeAll(async () => {
    // Fail loudly if the opt-in flag is on but the required env is missing
    // — otherwise the tests would silently exercise nothing.
    const missing = ['VITE_BASE44_APP_ID', 'VITE_BASE44_APP_BASE_URL', 'VITE_BASE44_API_KEY']
      .filter((k) => !import.meta.env?.[k]);
    if (missing.length) {
      throw new Error(
        `Live base44 tests opted in (VITE_TEST_LIVE_BASE44=true) but missing env: ${missing.join(', ')}`,
      );
    }
    ({ base44 } = await import('@/api/base44Client'));
  });

  afterAll(async () => {
    if (!base44) return;
    // Best-effort cleanup — don't fail the suite if a delete fails.
    for (const id of createdPersonaIds) {
      try { await base44.entities.Persona.delete(id); } catch { /* ignore */ }
    }
    for (const id of createdProxyIds) {
      try { await base44.entities.ProxyPool.delete(id); } catch { /* ignore */ }
    }
  });

  it('round-trips a Persona through create → list → update → delete', async () => {
    const created = await base44.entities.Persona.create({
      name: `${RUN_TAG}-persona-1`,
      description: 'Live smoke test — safe to delete',
    });
    expect(created?.id).toBeTruthy();
    createdPersonaIds.push(created.id);

    const list = await base44.entities.Persona.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p) => p.id === created.id)).toBe(true);

    const updated = await base44.entities.Persona.update(created.id, {
      description: 'Live smoke test — updated',
    });
    expect(updated?.description).toBe('Live smoke test — updated');

    await base44.entities.Persona.delete(created.id);
    createdPersonaIds.splice(createdPersonaIds.indexOf(created.id), 1);
  }, 30_000);

  it('round-trips a ProxyPool entry through create → list → update → delete', async () => {
    const created = await base44.entities.ProxyPool.create({
      label: `${RUN_TAG}-proxy-1`,
      type: 'custom',
      proxy_string: 'http://user:pass@proxy.example.com:8080',
      enabled: true,
    });
    expect(created?.id).toBeTruthy();
    createdProxyIds.push(created.id);

    const list = await base44.entities.ProxyPool.list('-created_date', 500);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p) => p.id === created.id)).toBe(true);

    const updated = await base44.entities.ProxyPool.update(created.id, { enabled: false });
    expect(updated?.enabled).toBe(false);

    await base44.entities.ProxyPool.delete(created.id);
    createdProxyIds.splice(createdProxyIds.indexOf(created.id), 1);
  }, 30_000);

  it('appends an AuditLog entry and finds it on list', async () => {
    // AuditLog is append-only in the product UI, so we only exercise create+list.
    const created = await base44.entities.AuditLog.create({
      action: 'LIVE_SMOKE_TEST',
      category: 'test',
      details: { runTag: RUN_TAG },
    });
    expect(created?.id).toBeTruthy();

    const recent = await base44.entities.AuditLog.list('-created_date', 50);
    expect(Array.isArray(recent)).toBe(true);
    expect(recent.some((e) => e.id === created.id)).toBe(true);
  }, 30_000);

  it('lists TestReport entries without error (read-only smoke)', async () => {
    const list = await base44.entities.TestReport.list('-created_date', 5);
    expect(Array.isArray(list)).toBe(true);
  }, 30_000);
});
