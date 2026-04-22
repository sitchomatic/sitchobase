import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The Base44 client module pulls real env + SDK on import. Mock it out so the
// helper module can load in a Node test environment.
vi.mock('@/api/base44Client', () => ({
  base44: { functions: { invoke: vi.fn() } },
}));

const ORIGINAL_ENV = { ...import.meta.env };

describe('isLikelyApiKeyBbProxyFailure', () => {
  let isLikelyApiKeyBbProxyFailure;

  beforeEach(async () => {
    const mod = await import('./bbClient');
    isLikelyApiKeyBbProxyFailure = mod.isLikelyApiKeyBbProxyFailure;
  });

  it('returns true for explicit 404 / 405 status on the error object', () => {
    expect(isLikelyApiKeyBbProxyFailure({ status: 404 })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ status: 405 })).toBe(true);
  });

  it('returns true for 404 / 405 status on err.response', () => {
    expect(isLikelyApiKeyBbProxyFailure({ response: { status: 404 } })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ response: { status: 405 } })).toBe(true);
  });

  it('returns true when the message text contains 404 or 405 as a whole number', () => {
    expect(isLikelyApiKeyBbProxyFailure({ message: 'Request failed with status code 404' })).toBe(true);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'HTTP 405 Method Not Allowed' })).toBe(true);
  });

  it('returns false for other statuses / messages', () => {
    expect(isLikelyApiKeyBbProxyFailure({ status: 500 })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ status: 401 })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'network error' })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({})).toBe(false);
  });

  it('does not match 404 / 405 embedded inside longer numbers', () => {
    // Guards against `/404/` matching e.g. 40455 in an unrelated id.
    expect(isLikelyApiKeyBbProxyFailure({ message: 'timeout after 4040ms' })).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure({ message: 'request id 140500' })).toBe(false);
  });

  it('tolerates null / undefined inputs without throwing', () => {
    expect(isLikelyApiKeyBbProxyFailure(null)).toBe(false);
    expect(isLikelyApiKeyBbProxyFailure(undefined)).toBe(false);
  });
});

describe('isUsingApiKeyAuth', () => {
  afterEach(() => {
    // Restore whatever Vite injected originally.
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in ORIGINAL_ENV)) delete import.meta.env[key];
    }
    Object.assign(import.meta.env, ORIGINAL_ENV);
  });

  it('is true when VITE_BASE44_API_KEY is set', async () => {
    import.meta.env.VITE_BASE44_API_KEY = 'test-key';
    const { isUsingApiKeyAuth } = await import('./bbClient');
    expect(isUsingApiKeyAuth()).toBe(true);
  });

  it('is false when VITE_BASE44_API_KEY is empty or missing', async () => {
    import.meta.env.VITE_BASE44_API_KEY = '';
    const { isUsingApiKeyAuth } = await import('./bbClient');
    expect(isUsingApiKeyAuth()).toBe(false);
  });
});
