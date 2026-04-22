import { describe, it, expect, vi } from 'vitest';
import { runWithConcurrency } from './concurrency';

describe('runWithConcurrency', () => {
  it('returns [] for empty or non-array input without invoking the worker', async () => {
    const worker = vi.fn();
    await expect(runWithConcurrency([], 5, worker)).resolves.toEqual([]);
    await expect(runWithConcurrency(null, 5, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('preserves input order in results even when workers resolve out of order', async () => {
    const delays = [30, 5, 20, 1, 15];
    const out = await runWithConcurrency(delays, 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return { i, ms };
    });
    expect(out).toHaveLength(delays.length);
    out.forEach((entry, i) => {
      expect(entry.status).toBe('fulfilled');
      expect(entry.value).toEqual({ i, ms: delays[i] });
    });
  });

  it('caps concurrent worker invocations at the given limit', async () => {
    let active = 0;
    let peak = 0;
    const worker = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
    });
    // 12 items, limit 3 → peak must never exceed 3.
    await runWithConcurrency(Array.from({ length: 12 }), 3, worker);
    expect(worker).toHaveBeenCalledTimes(12);
    expect(peak).toBeLessThanOrEqual(3);
    // And concurrency must actually be used — peak=1 would mean we serialised.
    expect(peak).toBeGreaterThan(1);
  });

  it('captures rejections as { status: "rejected" } without aborting siblings', async () => {
    const results = await runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n % 2 === 0) throw new Error(`boom-${n}`);
      return n * 10;
    });
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'rejected']);
    expect(results[0].value).toBe(10);
    expect(results[1].reason.message).toBe('boom-2');
    expect(results[2].value).toBe(30);
    expect(results[3].reason.message).toBe('boom-4');
  });

  it('treats a zero or negative limit as 1 rather than throwing', async () => {
    const out = await runWithConcurrency([1, 2], 0, async (n) => n);
    expect(out.map((r) => r.value)).toEqual([1, 2]);
  });
});
