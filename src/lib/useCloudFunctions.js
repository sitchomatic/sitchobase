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
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level: all hook instances across all pages share this. Tests reset it
// via __resetCloudFunctionsCacheForTests.
let unavailableCache = false;
const listeners = new Set();

function setUnavailable(next) {
  if (unavailableCache === next) return;
  unavailableCache = next;
  listeners.forEach((l) => l(next));
}

export function isEntityMissingError(err) {
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return true;
  const msg = String(err?.message ?? '');
  return /Entity schema .* not found/i.test(msg) || /\b404\b/.test(msg);
}

export function useCloudFunctions({ autoload = true } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailableState] = useState(unavailableCache);
  const [error, setError] = useState(null);

  // Subscribe to module-level unavailable flag so once one hook instance
  // discovers the 404, every other mounted instance flips over without
  // re-fetching.
  useEffect(() => {
    listeners.add(setUnavailableState);
    return () => { listeners.delete(setUnavailableState); };
  }, []);

  const reload = useCallback(async () => {
    if (unavailableCache) {
      setUnavailableState(true);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const data = await base44.entities.CloudFunction.list('-updated_date', 50);
      const next = Array.isArray(data) ? data : [];
      setItems(next);
      return next;
    } catch (err) {
      if (isEntityMissingError(err)) {
        setUnavailable(true);
        setUnavailableState(true);
        return [];
      }
      setError(err);
      return [];
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
      // reload() already called setItems; nothing extra needed, but retain
      // the cancelled check so tests can unmount without stale updates.
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
      setItems((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      if (isEntityMissingError(err)) {
        setUnavailable(true);
        setUnavailableState(true);
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

// Test-only: clear the module-level unavailable cache between tests.
export function __resetCloudFunctionsCacheForTests() {
  unavailableCache = false;
  listeners.forEach((l) => l(false));
}
