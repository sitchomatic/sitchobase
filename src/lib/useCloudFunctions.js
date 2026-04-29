/**
 * useCloudFunctions — shared hook for the CloudFunction entity.
 *
 * Handles the surface concerns every Cloud Function integration has:
 *  1. Load: list functions, tolerate a missing entity (404 from Base44) by
 *     remembering the "unavailable" state in a module-level cache so the
 *     Base44 SDK's 404 console spam fires at most once per page load.
 *  2. Save / Update / Delete: CRUD with dedup so double-clicks don't create
 *     duplicates, and entity-missing detection bubbled to the caller.
 *  3. Status: expose `unavailable`, `loading`, and `error` so UIs can hide
 *     pickers, show a "not deployed" explainer, or offer a retry instead of
 *     a broken empty dropdown.
 *
 * Every page that wants to read or write Cloud Functions uses this hook
 * instead of talking to base44.entities.CloudFunction directly. That keeps
 * the 404 suppression + cross-page cache in one place: once any surface
 * learns the entity is missing, every other surface's dropdown/picker
 * hides itself on the next render without triggering another fetch.
 *
 * All state is shared at the module level across hook instances:
 *  - `unavailableCache` broadcasts entity-missing.
 *  - `itemsCache`        broadcasts the list so a save from one surface
 *                        updates every other mounted picker immediately.
 *  - `inFlightList`      dedupes concurrent initial mounts (two pickers on
 *                        the same page only fire one network request and
 *                        thus only one potential 404 log line).
 *  - `inFlightSaves`     dedupes concurrent save calls keyed by name+script
 *                        so a double-click never creates two records.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// ── Module-level shared state ────────────────────────────────────────────────
let unavailableCache = false;
let unavailableAt = 0;
let itemsCache = [];
let inFlightList = null;
const inFlightSaves = new Map();

const unavailableListeners = new Set();
const itemsListeners = new Set();

// How long to trust a cached "entity missing" verdict before trying again.
// Five minutes is long enough to prevent 404 spam when the entity is really
// undeployed, short enough that a mid-session Base44 publish becomes visible
// without a full page reload.
export const UNAVAILABLE_TTL_MS = 5 * 60 * 1000;

// Hard cap on script body size — Base44 entity fields are limited and silent
// truncation is worse than a clear error.
export const MAX_SCRIPT_SIZE = 64 * 1024; // 64KB
export const MAX_NAME_LENGTH = 120;

function isUnavailableStale() {
  if (!unavailableCache) return false;
  return Date.now() - unavailableAt > UNAVAILABLE_TTL_MS;
}

function broadcastUnavailable(next) {
  if (next) unavailableAt = Date.now();
  if (unavailableCache === next) return;
  unavailableCache = next;
  unavailableListeners.forEach((l) => l(next));
}

function broadcastItems(next) {
  itemsCache = next;
  itemsListeners.forEach((l) => l(next));
}

/**
 * Detects whether an error represents a missing CloudFunction entity.
 * Checks for an HTTP 404 status on common error shapes or for message text
 * indicating "Entity schema ... not found" or a standalone `404` token.
 */
export function isEntityMissingError(err) {
  if (!err) return false;
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return true;
  const msg = String(err?.message ?? '');
  return /Entity schema .* not found/i.test(msg) || /\b404\b/.test(msg);
}

/**
 * Validates and normalizes a save payload. Throws a descriptive Error on
 * invalid input so callers don't have to duplicate the same checks.
 */
export function normalizeSavePayload(raw) {
  const name = String(raw?.name ?? '').trim();
  const script = String(raw?.script ?? '').trim();
  const description = String(raw?.description ?? '').trim();
  const runtime = String(raw?.runtime ?? 'playwright').trim() || 'playwright';

  if (!name) throw new Error('Function name is required');
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Function name must be ≤ ${MAX_NAME_LENGTH} characters`);
  if (!script) throw new Error('Function script is required');
  if (script.length > MAX_SCRIPT_SIZE) throw new Error(`Script body must be ≤ ${Math.round(MAX_SCRIPT_SIZE / 1024)}KB`);
  if (!['playwright', 'puppeteer', 'stagehand'].includes(runtime)) {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }

  return { name, script, description: description || undefined, runtime };
}

export function useCloudFunctions({ autoload = true } = {}) {
  const [items, setItemsState] = useState(itemsCache);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailableState] = useState(unavailableCache);
  const [error, setError] = useState(null);

  // Subscribe to module-level broadcasts so one hook instance learning the
  // entity is missing (or saving a new function) updates every other
  // mounted instance on the next render with no extra network traffic.
  useEffect(() => {
    unavailableListeners.add(setUnavailableState);
    itemsListeners.add(setItemsState);
    return () => {
      unavailableListeners.delete(setUnavailableState);
      itemsListeners.delete(setItemsState);
    };
  }, []);

  const reload = useCallback(async ({ force = false } = {}) => {
    // Suppress the fetch while the cached unavailable verdict is still
    // fresh. `force` (from retry()) and TTL expiry both fall through to
    // the live request below so a freshly-published entity can recover
    // without a full page reload.
    if (unavailableCache && !force && !isUnavailableStale()) {
      setUnavailableState(true);
      return [];
    }
    if (unavailableCache && (force || isUnavailableStale())) {
      broadcastUnavailable(false);
    }

    // Dedup concurrent callers
    if (!inFlightList) {
      inFlightList = (async () => {
        try {
          const data = await base44.entities.CloudFunction.list('-updated_date', 50);
          const next = Array.isArray(data) ? data : [];
          broadcastItems(next);
          return { ok: true, data: next };
        } catch (err) {
          if (isEntityMissingError(err)) {
            broadcastUnavailable(true);
            return { ok: true, data: [] };
          }
          return { ok: false, error: err };
        } finally {
          inFlightList = null;
        }
      })();
    }

    setLoading(true);
    setError(null);
    try {
      const result = await inFlightList;
      if (!result.ok) {
        setError(result.error);
        return [];
      }
      return result.data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoload) return;
    let cancelled = false;
    (async () => {
      const data = await reload();
      if (cancelled) return;
      void data;
    })();
    return () => { cancelled = true; };
  }, [autoload, reload]);

  const saveFunction = useCallback(async (payload) => {
    if (unavailableCache) {
      const err = new Error('Cloud Functions entity is not deployed to this Base44 app');
      err.entityMissing = true;
      throw err;
    }

    const clean = normalizeSavePayload(payload);
    // Dedup concurrent saves with identical name+script (e.g. double-click).
    const dedupKey = `${clean.name}::${clean.script.length}::${clean.script.slice(0, 64)}`;
    if (inFlightSaves.has(dedupKey)) return inFlightSaves.get(dedupKey);

    const promise = (async () => {
      try {
        const saved = await base44.entities.CloudFunction.create(clean);
        // Re-read the cache *now* so we don't trample updates made between
        // the user clicking save and Base44 returning.
        broadcastItems([saved, ...itemsCache]);
        return saved;
      } catch (err) {
        if (isEntityMissingError(err)) {
          broadcastUnavailable(true);
          err.entityMissing = true;
        }
        throw err;
      } finally {
        inFlightSaves.delete(dedupKey);
      }
    })();
    inFlightSaves.set(dedupKey, promise);
    return promise;
  }, []);

  const updateFunction = useCallback(async (id, patch) => {
    if (!id) throw new Error('Cloud function id is required');
    if (unavailableCache) {
      const err = new Error('Cloud Functions entity is not deployed to this Base44 app');
      err.entityMissing = true;
      throw err;
    }
    try {
      // If the patch carries fields we validate, run them through normalize so
      // the same constraints apply on edit as on create.
      const validated = (patch?.name || patch?.script || patch?.runtime || patch?.description !== undefined)
        ? normalizeSavePayload({
            name: patch.name ?? itemsCache.find((i) => i.id === id)?.name,
            script: patch.script ?? itemsCache.find((i) => i.id === id)?.script,
            description: patch.description ?? itemsCache.find((i) => i.id === id)?.description,
            runtime: patch.runtime ?? itemsCache.find((i) => i.id === id)?.runtime,
          })
        : patch;
      const updated = await base44.entities.CloudFunction.update(id, validated);
      broadcastItems(itemsCache.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      return updated;
    } catch (err) {
      if (isEntityMissingError(err)) {
        broadcastUnavailable(true);
        err.entityMissing = true;
      }
      throw err;
    }
  }, []);

  const deleteFunction = useCallback(async (id) => {
    if (!id) throw new Error('Cloud function id is required');
    if (unavailableCache) {
      const err = new Error('Cloud Functions entity is not deployed to this Base44 app');
      err.entityMissing = true;
      throw err;
    }
    try {
      await base44.entities.CloudFunction.delete(id);
      broadcastItems(itemsCache.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      if (isEntityMissingError(err)) {
        broadcastUnavailable(true);
        err.entityMissing = true;
      }
      throw err;
    }
  }, []);

  const retry = useCallback(() => reload({ force: true }), [reload]);

  return {
    items,
    loading,
    unavailable,
    error,
    reload,
    retry,
    saveFunction,
    updateFunction,
    deleteFunction,
  };
}

// Test-only escape hatches.
export function __resetCloudFunctionsCacheForTests() {
  unavailableCache = false;
  unavailableAt = 0;
  itemsCache = [];
  inFlightList = null;
  inFlightSaves.clear();
  unavailableListeners.forEach((l) => l(false));
  itemsListeners.forEach((l) => l([]));
}

export function __getUnavailableStateForTests() {
  return { unavailable: unavailableCache, unavailableAt };
}

export function __getItemsCacheForTests() {
  return itemsCache;
}

export function __getInFlightSavesSizeForTests() {
  return inFlightSaves.size;
}