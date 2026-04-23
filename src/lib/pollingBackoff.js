/**
 * Adaptive polling interval with exponential backoff on consecutive failures.
 *
 * Usage:
 *   const poll = createPollingBackoff({ baseMs: 15000, maxMs: 5 * 60_000 });
 *   const tick = async () => {
 *     try {
 *       await fetchStuff();
 *       poll.onSuccess();
 *     } catch {
 *       poll.onFailure();
 *     } finally {
 *       setTimeout(tick, poll.getIntervalMs());
 *     }
 *   };
 */
export function createPollingBackoff({ baseMs = 15_000, maxMs = 5 * 60_000, factor = 2 } = {}) {
  let failures = 0;

  return {
    onSuccess() { failures = 0; },
    onFailure() { failures++; },
    getFailures() { return failures; },
    getIntervalMs() {
      if (failures === 0) return baseMs;
      // Exponential with cap: baseMs * factor^failures
      const ms = baseMs * Math.pow(factor, failures);
      return Math.min(ms, maxMs);
    },
    reset() { failures = 0; },
  };
}