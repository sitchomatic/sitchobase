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
 * read-only check on TestRun (the entity backing the Test Reports page).
 *
 * Each test creates its records with a unique run tag so concurrent runs
 * don't collide, and deletes what it created in `afterAll`. If a test
 * fails partway through, leftover rows are tagged `devin-live-smoke-*`
 * so you can grep and clean them up manually.
 *
 * Runs under the default `node` environment (which has native `fetch` and
 * no same-origin restrictions), with a hand-rolled `window` shim below so
 * the Base44 SDK's analytics module — which registers a `visibilitychange`
 * listener on `window` at client-construction time — doesn't crash. We
 * deliberately avoid `jsdom` / `happy-dom` here because their CORS-aware
 * XHR-backed fetch rejects Base44's cross-origin calls as "Network Error".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@base44/sdk';

const LIVE = String(import.meta.env?.VITE_TEST_LIVE_BASE44 ?? '').toLowerCase() === 'true';

const RUN_TAG = `devin-live-smoke-${Date.now()}`;

describe.skipIf(!LIVE)('base44 live entity CRUD', () => {
  let base44;
  const createdPersonaIds = [];
  const createdProxyIds = [];

  // Capture original globals so we can restore them in afterAll
  let origWindow;
  let origDocument;
  let origLocalStorage;
  let origHistory;

  beforeAll(async () => {
    // Minimal browser-ish window shim for Node env. See header comment for why
    // we don't use jsdom here. Must include add/removeEventListener because the
    // Base44 SDK's analytics module registers a `visibilitychange` listener at
    // client construction time. Only install the shim when LIVE tests are enabled.
    if (LIVE && typeof globalThis.window === 'undefined') {
      origWindow = globalThis.window;
      origDocument = globalThis.document;
      origLocalStorage = globalThis.localStorage;
      origHistory = globalThis.history;

      const storage = new Map();
      globalThis.window = {
        location: { search: '', pathname: '/', href: 'http://localhost/', hash: '' },
        history: { replaceState: () => {} },
        addEventListener: () => {},
        removeEventListener: () => {},
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

    // Fail loudly if the opt-in flag is on but the required env is missing
    // — otherwise the tests would silently exercise nothing.
    const missing = ['VITE_BASE44_APP_ID', 'VITE_BASE44_APP_BASE_URL', 'VITE_BASE44_API_KEY']
      .filter((k) => !import.meta.env?.[k]);
    if (missing.length) {
      throw new Error(
        `Live base44 tests opted in (VITE_TEST_LIVE_BASE44=true) but missing env: ${missing.join(', ')}`,
      );
    }
    // Build a dedicated SDK client with an explicit absolute `serverUrl`.
    // `src/api/base44Client.js` ships with `serverUrl: ''` so the browser
    // resolves requests relative to its current host — that doesn't work in
    // a Node test runner, where we need a fully-qualified URL.
    base44 = createClient({
      appId: import.meta.env.VITE_BASE44_APP_ID,
      token: null,
      requiresAuth: false,
      serverUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
      appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
      headers: { api_key: import.meta.env.VITE_BASE44_API_KEY },
    });
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

    // Restore original globals to avoid leaking the shim to other tests
    if (LIVE) {
      if (origWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = origWindow;
      }
      if (origDocument === undefined) {
        delete globalThis.document;
      } else {
        globalThis.document = origDocument;
      }
      if (origLocalStorage === undefined) {
        delete globalThis.localStorage;
      } else {
        globalThis.localStorage = origLocalStorage;
      }
      if (origHistory === undefined) {
        delete globalThis.history;
      } else {
        globalThis.history = origHistory;
      }
    }
  });

  it('round-trips a Persona through create → list → update → delete', async () => {
    // Persona schema: { name, notes, deviceType, userAgent, useProxy, region,
    // proxyCountry }. `notes` is the free-text field — there is no
    // `description`; the server silently drops unknown keys.
    const created = await base44.entities.Persona.create({
      name: `${RUN_TAG}-persona-1`,
      notes: 'Live smoke test — safe to delete',
    });
    expect(created?.id).toBeTruthy();
    createdPersonaIds.push(created.id);

    const list = await base44.entities.Persona.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p) => p.id === created.id)).toBe(true);

    await base44.entities.Persona.update(created.id, {
      notes: 'Live smoke test — updated',
    });
    // Re-fetch via list to verify the mutation actually persisted server-side.
    const refreshed = await base44.entities.Persona.list();
    const refreshedPersona = refreshed.find((p) => p.id === created.id);
    expect(refreshedPersona?.notes).toBe('Live smoke test — updated');

    await base44.entities.Persona.delete(created.id);
    const personaIndex = createdPersonaIds.indexOf(created.id);
    if (personaIndex !== -1) {
      createdPersonaIds.splice(personaIndex, 1);
    }

    // Verify the persona is actually gone after deletion
    const afterDelete = await base44.entities.Persona.list();
    expect(afterDelete.some((p) => p.id === created.id)).toBe(false);
  }, 30_000);

  it('round-trips a ProxyPool entry through create → list → update → delete', async () => {
    // Schema mirrors `parseProxyList` / `toBrowserbaseProxy` in src/lib/proxyPool.js
    // — the canonical ProxyPool shape is `{ server, username?, password?, enabled }`.
    const created = await base44.entities.ProxyPool.create({
      server: `proxy.${RUN_TAG}.example.com:8080`,
      username: 'smoke-user',
      password: 'smoke-pass',
      enabled: true,
    });
    expect(created?.id).toBeTruthy();
    createdProxyIds.push(created.id);

    const list = await base44.entities.ProxyPool.list('-created_date', 500);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((p) => p.id === created.id)).toBe(true);

    await base44.entities.ProxyPool.update(created.id, { enabled: false });
    const refreshed = await base44.entities.ProxyPool.list('-created_date', 500);
    const refreshedProxy = refreshed.find((p) => p.id === created.id);
    expect(refreshedProxy?.enabled).toBe(false);

    await base44.entities.ProxyPool.delete(created.id);
    const proxyIndex = createdProxyIds.indexOf(created.id);
    if (proxyIndex !== -1) {
      createdProxyIds.splice(proxyIndex, 1);
    }

    // Verify the proxy is actually gone after deletion
    const afterDelete = await base44.entities.ProxyPool.list('-created_date', 500);
    expect(afterDelete.some((p) => p.id === created.id)).toBe(false);
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

  it('lists TestRun entries without error (read-only smoke)', async () => {
    // The "Test Reports" page is backed by the `TestRun` entity, not
    // `TestReport` — see src/pages/TestReports.jsx.
    const list = await base44.entities.TestRun.list('-created_date', 5);
    expect(Array.isArray(list)).toBe(true);
  }, 30_000);
});