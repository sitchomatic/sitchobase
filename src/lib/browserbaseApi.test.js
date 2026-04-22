import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { batchCreateSessions } from './browserbaseApi';

describe('batchCreateSessions', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = origFetch;
  });

  it('records an error when 429 retries are exhausted (no silent drops)', async () => {
    // All createSession calls return 429; after MAX_ATTEMPTS (5) the loop exits.
    // Regression: previously the session was silently dropped, so callers ended
    // up with fewer sessions than they asked for and no matching error entry.
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }));

    const promise = batchCreateSessions('test-key', 1, {});
    await vi.runAllTimersAsync();
    const { results, errors } = await promise;

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ index: 0 });
    expect(errors[0].error).toMatch(/429|Failed after/);
  });

  it('pushes a non-429 error immediately and does not duplicate it on exhaustion', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }));

    const promise = batchCreateSessions('test-key', 1, {});
    await vi.runAllTimersAsync();
    const { results, errors } = await promise;

    expect(results).toHaveLength(0);
    // Non-429 exits the retry loop with success=true (intentional), so there
    // should be exactly one error entry, not two.
    expect(errors).toHaveLength(1);
  });

  it('returns successful sessions in results on the happy path', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'sess_abc' }),
      json: async () => ({ id: 'sess_abc' }),
    }));

    const promise = batchCreateSessions('test-key', 2, {});
    await vi.runAllTimersAsync();
    const { results, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: 'sess_abc' });
  });
});
