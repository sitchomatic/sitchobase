import { describe, it, expect, vi } from 'vitest';
import { parseJoeIgniteRun, parseProxyPool, parseBbSession, safeParseMany } from './safeParse.js';

describe('parseJoeIgniteRun', () => {
  it('returns null on missing required fields', () => {
    expect(parseJoeIgniteRun(null)).toBeNull();
    expect(parseJoeIgniteRun({})).toBeNull();
    expect(parseJoeIgniteRun({ email: 'a@b.c' })).toBeNull();
  });
  it('normalizes defaults for missing optional fields', () => {
    const r = parseJoeIgniteRun({ email: 'a@b.c', batchId: 'x' });
    expect(r.status).toBe('queued');
    expect(r.attempts).toBe(0);
    expect(r.isBurned).toBe(false);
  });
});

describe('parseProxyPool', () => {
  it('requires server', () => {
    expect(parseProxyPool({})).toBeNull();
    expect(parseProxyPool({ server: '' })).toBeNull();
  });
  it('defaults enabled to true', () => {
    expect(parseProxyPool({ server: 'a:1' }).enabled).toBe(true);
    expect(parseProxyPool({ server: 'a:1', enabled: false }).enabled).toBe(false);
  });
});

describe('parseBbSession', () => {
  it('requires id', () => {
    expect(parseBbSession({})).toBeNull();
  });
  it('passes through extra fields', () => {
    const r = parseBbSession({ id: 's1', customField: 'x' });
    expect(r.customField).toBe('x');
  });
});

describe('safeParseMany', () => {
  it('filters out malformed records silently', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = [
      { email: 'a@b.c', batchId: 'x' },
      { email: 'bad' }, // missing batchId
      { email: 'c@d.e', batchId: 'y' },
    ];
    const out = safeParseMany(input, parseJoeIgniteRun, 'JoeIgniteRun');
    expect(out.length).toBe(2);
  });
  it('returns [] for non-array', () => {
    expect(safeParseMany(null, parseJoeIgniteRun)).toEqual([]);
  });
});