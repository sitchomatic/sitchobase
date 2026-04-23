import { describe, it, expect } from 'vitest';
import { createPollingBackoff } from './pollingBackoff.js';

describe('pollingBackoff', () => {
  it('returns baseMs when no failures', () => {
    const p = createPollingBackoff({ baseMs: 1000 });
    expect(p.getIntervalMs()).toBe(1000);
  });

  it('doubles on each failure up to max', () => {
    const p = createPollingBackoff({ baseMs: 1000, maxMs: 10_000 });
    p.onFailure(); expect(p.getIntervalMs()).toBe(2000);
    p.onFailure(); expect(p.getIntervalMs()).toBe(4000);
    p.onFailure(); expect(p.getIntervalMs()).toBe(8000);
    p.onFailure(); expect(p.getIntervalMs()).toBe(10_000);
    p.onFailure(); expect(p.getIntervalMs()).toBe(10_000);
  });

  it('resets on success', () => {
    const p = createPollingBackoff({ baseMs: 1000 });
    p.onFailure(); p.onFailure();
    p.onSuccess();
    expect(p.getIntervalMs()).toBe(1000);
    expect(p.getFailures()).toBe(0);
  });
});