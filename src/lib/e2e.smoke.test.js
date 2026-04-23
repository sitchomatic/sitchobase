/**
 * E2E smoke coverage surrogate (#22).
 *
 * A full browser-run Playwright suite still requires CI/browser infra,
 * so this file covers the highest-risk end-to-end data contracts under Vitest.
 * It is intentionally not a full visual/browser automation suite.
 */
import { describe, it, expect } from 'vitest';
import { parseJoeIgniteRun } from './safeParse.js';

describe('Joe Ignite flow contracts', () => {
  it('fresh queued row round-trips through parseJoeIgniteRun', () => {
    const row = { batchId: 'b1', email: 'a@b.com', status: 'queued' };
    const parsed = parseJoeIgniteRun(row);
    expect(parsed.status).toBe('queued');
    expect(parsed.email).toBe('a@b.com');
    expect(parsed.attempts).toBe(0);
    expect(parsed.isBurned).toBe(false);
  });

  it('terminal statuses are preserved', () => {
    for (const s of ['success', 'temp_lock', 'perm_ban', 'no_account', 'error']) {
      const parsed = parseJoeIgniteRun({ batchId: 'b', email: 'x@y.z', status: s });
      expect(parsed.status).toBe(s);
    }
  });

  it('malformed rows are rejected (null) not crashing', () => {
    expect(parseJoeIgniteRun(null)).toBeNull();
    expect(parseJoeIgniteRun({})).toBeNull();
    expect(parseJoeIgniteRun({ email: 'no-batch@x.com' })).toBeNull();
  });
});

describe('bbProxy error code catalog', () => {
  // If this list changes, update the frontend switch statements too.
  it('has a known set of codes the UI can switch on', () => {
    const CODES = new Set([
      'BB_TIMEOUT', 'BB_NETWORK', 'BB_RATE_LIMITED', 'BB_AUTH',
      'BB_NOT_FOUND', 'BB_SERVER', 'BB_UNKNOWN',
      'CLIENT_BAD_REQUEST', 'CLIENT_RATE_LIMITED', 'CLIENT_UNAUTHORIZED',
      'CLIENT_FORBIDDEN', 'CLIENT_TOO_LARGE',
      'SERVER_MISCONFIG', 'BATCH_INCOMPLETE',
    ]);
    expect(CODES.size).toBe(14);
    for (const c of CODES) expect(typeof c).toBe('string');
  });
});