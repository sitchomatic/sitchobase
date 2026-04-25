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
export function createPollingBackoff({ baseMs = 15_000, maxMs = 5 * 60_000, factor = 2, jitter = 0 } = {}) {
  let failures = 0;

  return {
    onSuccess() { failures = 0; },
    onFailure() { failures++; },
    getFailures() { return failures; },
    getIntervalMs() {
      const rawMs = failures === 0 ? baseMs : Math.min(baseMs * Math.pow(factor, failures), maxMs);
      if (!jitter) return rawMs;
      const spread = rawMs * jitter;
      return Math.max(0, Math.round(rawMs + (Math.random() * 2 - 1) * spread));
    },
    reset() { failures = 0; },
  };
}