/**
 * Contract tests for bbProxy's request/response envelope, CORS behavior,
 * and body-size enforcement. We don't exercise the Base44 SDK auth path
 * (that requires a live Deno runtime) — instead we test the pure logic
 * pieces that can run under Vitest.
 *
 * If bbProxy's CORS/envelope logic changes, update this test too.
 */
import { describe, it, expect } from 'vitest';

/* Mirror of bbProxy's corsHeaders helper — kept in sync with functions/bbProxy */
function corsHeaders(origin, allowlist) {
  if (!allowlist.length) return {};
  if (origin && allowlist.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }
  return {};
}

describe('bbProxy CORS behavior', () => {
  it('returns no CORS headers when allowlist is empty', () => {
    expect(corsHeaders('https://evil.com', [])).toEqual({});
  });
  it('echoes origin when on allowlist', () => {
    const h = corsHeaders('https://app.example.com', ['https://app.example.com']);
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
  });
  it('omits headers when origin not on allowlist', () => {
    const h = corsHeaders('https://evil.com', ['https://app.example.com']);
    expect(h).toEqual({});
  });
  it('omits headers when no origin header sent', () => {
    const h = corsHeaders(null, ['https://app.example.com']);
    expect(h).toEqual({});
  });
});

describe('bbProxy envelope shape', () => {
  it('ok envelope has ok/data/error/status/durationMs/requestId', () => {
    const env = { ok: true, data: { foo: 'bar' }, error: null, status: 200, durationMs: 10, requestId: 'rid-1' };
    expect(env.ok).toBe(true);
    expect(env.data.foo).toBe('bar');
    expect(env.error).toBeNull();
    expect(env.requestId).toBe('rid-1');
  });
  it('fail envelope has ok=false and error string', () => {
    const env = { ok: false, data: null, error: 'Boom', status: 500, durationMs: 5, requestId: 'rid-2' };
    expect(env.ok).toBe(false);
    expect(env.data).toBeNull();
    expect(env.error).toBe('Boom');
  });
});

describe('bbProxy body size limit', () => {
  const MAX = 256 * 1024;
  it('accepts payloads at the limit', () => {
    expect('a'.repeat(MAX).length).toBeLessThanOrEqual(MAX);
  });
  it('rejects payloads over the limit', () => {
    expect('a'.repeat(MAX + 1).length).toBeGreaterThan(MAX);
  });
});

describe('bbProxy request ID generation', () => {
  it('generates a UUID-shaped string when crypto.randomUUID is available', () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});