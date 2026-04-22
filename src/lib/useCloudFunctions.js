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
let unavailableAt = 0;
let itemsCache = [];
let inFlightList = null;

const unavailableListeners = new Set();
const itemsListeners = new Set();

// How long to trust a cached "entity missing" verdict before trying again.
// Five minutes is long enough to prevent 404 spam when the entity is really
// undeployed, short enough that a mid-session Base44 publish becomes visible
// without a full page reload.
export const UNAVAILABLE_TTL_MS = 5 * 60 * 1000;

function isUnavailableStale() {
  if (!unavailableCache) return false;
  return Date.now() - unavailableAt > UNAVAILABLE_TTL_MS;
}

/**
 * Update and broadcast the CloudFunction availability flag to registered listeners.
 *
 * Does nothing if the value is unchanged to avoid redundant notifications.
 * @param {boolean} next - `true` when the CloudFunction entity is missing for this app, `false` otherwise.
 */
function broadcastUnavailable(next) {
  if (next) unavailableAt = Date.now();
  if (unavailableCache === next) return;
  unavailableCache = next;
  unavailableListeners.forEach((l) => l(next));
}

/**
 * Update the shared cloud-functions items cache and notify all registered listeners with the new list.
 * @param {Array} next - The new array of cloud function items to store and broadcast to listeners.
 */
function broadcastItems(next) {
  itemsCache = next;
  itemsListeners.forEach((l) => l(next));
}

/**
 * Detects whether an error represents a missing CloudFunction entity.
 *
 * Checks for an HTTP 404 status on common error shapes or for message text indicating
 * "Entity schema ... not found" or a standalone `404` token.
 * @param {*} err - The error object or value to inspect.
 * @returns {boolean} `true` if the error indicates the entity is missing (404), `false` otherwise.
 */
export function isEntityMissingError(err) {
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return true;
  const msg = String(err?.message ?? '');
  return /Entity schema .* not found/i.test(msg) || /\b404\b/.test(msg);
}

/**
 * Provide shared, cross-instance state and operations for managing CloudFunction entities.
 *
 * Exposes the current list of functions, loading and availability status, last non-missing error,
 * and actions to reload the list or create a new function. State is synchronized across hook
 * instances: list requests are deduplicated and updates/broadcasts propagate to all mounted hooks.
 *
 * @param {Object} [options] - Hook options.
 * @param {boolean} [options.autoload=true] - If true, triggers an initial `reload()` on mount.
 * @returns {{items: Array, loading: boolean, unavailable: boolean, error: Error|null, reload: function({force?: boolean}=): Promise<Array>, retry: function(): Promise<Array>, saveFunction: function(Object): Promise<Object>}} An object containing:
 *  - `items`: current array of CloudFunction entities (may be empty).
 *  - `loading`: whether a reload operation is in progress.
 *  - `unavailable`: true if the CloudFunction entity is known to be missing for this app.
 *  - `error`: the last non-missing error observed by `reload()`, or `null`.
 *  - `reload`: async function that fetches the list of functions; pass `{ force: true }` to bypass the unavailable cache.
 *  - `retry`: convenience wrapper around `reload({ force: true })` for explicit "the entity might be deployed now" retries.
 *  - `saveFunction`: async function that creates a CloudFunction from a payload and returns the created entity.
 */
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

  const retry = useCallback(() => reload({ force: true }), [reload]);

  return {
    items,
    loading,
    unavailable,
    error,
    reload,
    retry,
    saveFunction,
  };
}

// Test-only: clear every module-level cache between tests so suites don't
// leak state into each other.
/**
 * Reset module-level caches and notify all subscribers, restoring the hook to its initial state for tests.
 *
 * This clears `unavailableCache`, `itemsCache`, and `inFlightList`, then calls all registered `unavailableListeners` with `false` and all `itemsListeners` with an empty array to update mounted hook instances.
 */
export function __resetCloudFunctionsCacheForTests() {
  unavailableCache = false;
  unavailableAt = 0;
  itemsCache = [];
  inFlightList = null;
  unavailableListeners.forEach((l) => l(false));
  itemsListeners.forEach((l) => l([]));
}

// Test-only accessor: lets tests assert TTL behaviour without exposing the
// module internals to production code.
export function __getUnavailableStateForTests() {
  return { unavailable: unavailableCache, unavailableAt };
}
