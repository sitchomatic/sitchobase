/**
 * Client-side circuit breaker for bbClient calls.
 *
 * States:
 *   - closed   : requests pass through (normal)
 *   - open     : requests fail fast (recent failure storm)
 *   - half-open: one probe request allowed after cool-down
 *
 * Thresholds tuned for a fleet-management UI:
 *   - Trip after 10 consecutive failures in a 60s window
 *   - Cool-down 30s before a probe
 *   - Any probe success closes the circuit; failure re-opens it
 */

const DEFAULTS = {
  failureThreshold: 10,
  failureWindowMs: 60_000,
  cooldownMs: 30_000,
};

export function createCircuitBreaker(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  let state = 'closed';
  let failureTimes = []; // rolling window of failure timestamps
  let openedAt = 0;

  const now = () => (opts.now ? opts.now() : Date.now());

  function pruneFailures() {
    const cutoff = now() - cfg.failureWindowMs;
    failureTimes = failureTimes.filter((t) => t > cutoff);
  }

  function canRequest() {
    if (state === 'closed') return true;
    if (state === 'open') {
      if (now() - openedAt >= cfg.cooldownMs) {
        state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow exactly one probe
    return true;
  }

  function recordSuccess() {
    failureTimes = [];
    state = 'closed';
  }

  function recordFailure() {
    if (state === 'half-open') {
      // probe failed — re-open
      state = 'open';
      openedAt = now();
      return;
    }
    failureTimes.push(now());
    pruneFailures();
    if (failureTimes.length >= cfg.failureThreshold) {
      state = 'open';
      openedAt = now();
    }
  }

  function getState() {
    pruneFailures();
    return { state, failures: failureTimes.length, openedAt };
  }

  function reset() {
    state = 'closed';
    failureTimes = [];
    openedAt = 0;
  }

  return { canRequest, recordSuccess, recordFailure, getState, reset };
}

/** Custom error thrown when circuit is open */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open — Browserbase appears to be failing') {
    super(message);
    this.name = 'CircuitOpenError';
    this.status = 503;
    this.isCircuitOpen = true;
  }
}