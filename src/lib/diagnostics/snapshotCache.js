/**
 * In-memory cache of DOM snapshots captured at failure time.
 *
 * We don't persist these to the entity (would balloon record size) — they
 * live in memory for the current session and are surfaced in the Smart
 * Retry dialog so the operator can see what the page actually looked like
 * when the failure happened.
 *
 * Key shape: `${runId}:${rowIndex}` for AuthorizedBulkQA failures.
 */
const cache = new Map();
const MAX_ENTRIES = 100;

export function storeSnapshot(key, snapshot) {
  if (!key) return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { ...snapshot, capturedAt: new Date().toISOString() });
}

export function getSnapshot(key) {
  return key ? cache.get(key) || null : null;
}