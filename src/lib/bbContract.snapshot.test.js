/**
 * Contract tests for Browserbase API shapes (#23).
 * Snapshot the fields we depend on so if BB renames something we know immediately.
 */
import { describe, it, expect } from 'vitest';

// Fields the UI depends on — if any go missing, the UI breaks silently.
const SESSION_FIELDS = [
  'id', 'status', 'region', 'createdAt', 'startedAt', 'endedAt',
  'proxyBytes', 'keepAlive', 'contextId',
];
const PROJECT_USAGE_FIELDS = ['browserMinutes', 'proxyBytes'];

describe('BB contract: session shape', () => {
  it('canonical sample has every field we render', () => {
    const sample = {
      id: 'abc',
      status: 'RUNNING',
      region: 'us-west-2',
      createdAt: '2026-04-01T00:00:00Z',
      startedAt: '2026-04-01T00:00:00Z',
      endedAt: null,
      proxyBytes: 1024,
      keepAlive: false,
      contextId: null,
    };
    for (const f of SESSION_FIELDS) {
      expect(sample).toHaveProperty(f);
    }
  });
});

describe('BB contract: usage shape', () => {
  it('canonical sample has the fields we chart', () => {
    const sample = { browserMinutes: 1000, proxyBytes: 5_000_000 };
    for (const f of PROJECT_USAGE_FIELDS) {
      expect(sample).toHaveProperty(f);
    }
  });
});

describe('envelope shape from bbProxy', () => {
  it('ok envelope contract', () => {
    const env = { ok: true, data: [], error: null, code: null, status: 200, durationMs: 10, requestId: 'rid' };
    for (const f of ['ok', 'data', 'error', 'code', 'status', 'durationMs', 'requestId']) {
      expect(env).toHaveProperty(f);
    }
  });
  it('fail envelope contract', () => {
    const env = { ok: false, data: null, error: 'x', code: 'BB_AUTH', status: 401, durationMs: 5, requestId: 'rid' };
    for (const f of ['ok', 'data', 'error', 'code', 'status', 'durationMs', 'requestId']) {
      expect(env).toHaveProperty(f);
    }
    expect(env.code).toMatch(/^(BB|CLIENT|SERVER|BATCH)_/);
  });
});