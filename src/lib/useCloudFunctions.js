/**
 * useCloudFunctions — shared hook for the CloudFunction entity.
 *
 * Handles the three surface concerns every Cloud Function integration has:
 *  1. Load: list functions, tolerate a missing entity (404 from Base44) by
 *     remembering the "unavailable" state in a module-level cache so the
 *     Base44 SDK's 404 console spam fires at most once per page load.
 *  2. Save: create a new function; disable when the entity is unavailable.
 *  3. Status: expose `unavailable` + `loading` so UIs can hide pickers /
 *     show a "not deployed" explainer instead of a broken empty dropdown.
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
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// ── Module-level shared state ────────────────────────────────────────────────
let unavailableCache = false;
let itemsCache = [];
let inFlightList = null;

const unavailableListeners = new Set();
const itemsListeners = new Set();

function broadcastUnavailable(next) {
  if (unavailableCache === next) return;
  unavailableCache = next;
  unavailableListeners.forEach((l) => l(next));
}

function broadcastItems(next) {
  itemsCache = next;
  itemsListeners.forEach((l) => l(next));
}

export function isEntityMissingError(err) {
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return true;
  const msg = String(err?.message ?? '');
  return /Entity schema .* not found/i.test(msg) || /\b404\b/.test(msg);
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

  const reload = useCallback(async () => {
    if (unavailableCache) {
      setUnavailableState(true);
      return [];
    }

    // Dedup concurrent callers: two <CloudFunctionPicker>s mounted on the
    // same page at the same time should share one list() promise, otherwise
    // the Base44 SDK logs the 404 twice before unavailableCache flips.
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
    try {
      const saved = await base44.entities.CloudFunction.create(payload);
      broadcastItems([saved, ...itemsCache]);
      return saved;
    } catch (err) {
      if (isEntityMissingError(err)) {
        broadcastUnavailable(true);
        err.entityMissing = true;
      }
      throw err;
    }
  }, []);

  return {
    items,
    loading,
    unavailable,
    error,
    reload,
    saveFunction,
  };
}

// Test-only: clear every module-level cache between tests so suites don't
// leak state into each other.
export function __resetCloudFunctionsCacheForTests() {
  unavailableCache = false;
  itemsCache = [];
  inFlightList = null;
  unavailableListeners.forEach((l) => l(false));
  itemsListeners.forEach((l) => l([]));
}
