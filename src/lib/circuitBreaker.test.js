import { describe, it, expect } from 'vitest';
import { createCircuitBreaker, CircuitOpenError } from './circuitBreaker.js';

function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

describe('circuitBreaker', () => {
  it('starts closed and allows requests', () => {
    const cb = createCircuitBreaker();
    expect(cb.canRequest()).toBe(true);
    expect(cb.getState().state).toBe('closed');
  });

  it('opens after threshold consecutive failures', () => {
    const clock = makeClock();
    const cb = createCircuitBreaker({ failureThreshold: 3, now: clock.now });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().state).toBe('closed');
    cb.recordFailure();
    expect(cb.getState().state).toBe('open');
    expect(cb.canRequest()).toBe(false);
  });

  it('resets failure count on success', () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().state).toBe('closed');
  });

  it('transitions open → half-open after cooldown', () => {
    const clock = makeClock();
    const cb = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: clock.now });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canRequest()).toBe(false);
    clock.advance(1001);
    expect(cb.canRequest()).toBe(true);
    expect(cb.getState().state).toBe('half-open');
  });

  it('closes on probe success', () => {
    const clock = makeClock();
    const cb = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: clock.now });
    cb.recordFailure(); cb.recordFailure();
    clock.advance(1001);
    cb.canRequest(); // move to half-open
    cb.recordSuccess();
    expect(cb.getState().state).toBe('closed');
  });

  it('re-opens on probe failure', () => {
    const clock = makeClock();
    const cb = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: clock.now });
    cb.recordFailure(); cb.recordFailure();
    clock.advance(1001);
    cb.canRequest(); // half-open
    cb.recordFailure();
    expect(cb.getState().state).toBe('open');
  });

  it('prunes failures outside rolling window', () => {
    const clock = makeClock();
    const cb = createCircuitBreaker({ failureThreshold: 3, failureWindowMs: 1000, now: clock.now });
    cb.recordFailure();
    cb.recordFailure();
    clock.advance(1100);
    cb.recordFailure(); // old ones now pruned
    expect(cb.getState().state).toBe('closed');
    expect(cb.getState().failures).toBe(1);
  });

  it('CircuitOpenError has correct shape', () => {
    const err = new CircuitOpenError();
    expect(err.status).toBe(503);
    expect(err.isCircuitOpen).toBe(true);
  });
});