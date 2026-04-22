/**
 * Bounded-concurrency helper that mirrors `Promise.allSettled` semantics but
 * caps the number of in-flight workers at any given moment.
 *
 * Motivation: pages like Monitor fire per-session API calls on every refresh
 * tick. With a fleet of 30+ RUNNING sessions, an unbounded `Promise.all*`
 * issues 30 concurrent requests per endpoint per 15s refresh — plenty to
 * hit Browserbase rate limits or slow the refresh cycle visibly. Capping
 * concurrency keeps the refresh predictable while still parallelising the
 * typical 1–5 session case at full speed.
 *
 * Results are returned in input order with the same `{ status, value }` /
 * `{ status, reason }` shape that `Promise.allSettled` produces, so call
 * sites can switch between the two without touching result handling.
 *
 * @template T, R
 * @param {T[]} items - Items to process.
 * @param {number} limit - Maximum number of concurrent `worker` invocations.
 * @param {(item: T, index: number) => Promise<R>} worker - Async worker.
 * @returns {Promise<Array<{status: 'fulfilled', value: R} | {status: 'rejected', reason: unknown}>>}
 */
export async function runWithConcurrency(items, limit, worker) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit | 0 || 1, items.length));
  const results = new Array(items.length);
  let cursor = 0;

  async function drain() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, drain));
  return results;
}
