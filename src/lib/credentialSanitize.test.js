import { describe, it, expect } from 'vitest';
import { sanitizeCredential, warnApiKey, warnProjectId } from './credentialSanitize.js';

describe('sanitizeCredential', () => {
  it('trims whitespace and newlines', () => {
    expect(sanitizeCredential('  bb_live_abc  \n')).toBe('bb_live_abc');
  });
  it('strips surrounding quotes', () => {
    expect(sanitizeCredential('"bb_live_abc"')).toBe('bb_live_abc');
    expect(sanitizeCredential("'bb_live_abc'")).toBe('bb_live_abc');
    expect(sanitizeCredential('`bb_live_abc`')).toBe('bb_live_abc');
  });
  it('strips Bearer prefix', () => {
    expect(sanitizeCredential('Bearer bb_live_abc')).toBe('bb_live_abc');
    expect(sanitizeCredential('bearer   bb_live_abc')).toBe('bb_live_abc');
  });
  it('strips env-var prefix', () => {
    expect(sanitizeCredential('BROWSERBASE_API_KEY=bb_live_abc')).toBe('bb_live_abc');
    expect(sanitizeCredential('API_KEY: "bb_live_abc"')).toBe('bb_live_abc');
  });
  it('removes zero-width characters', () => {
    expect(sanitizeCredential('bb_live_\u200Babc\uFEFF')).toBe('bb_live_abc');
  });
  it('returns empty for nullish', () => {
    expect(sanitizeCredential(null)).toBe('');
    expect(sanitizeCredential(undefined)).toBe('');
  });
  it('takes first token if multiple words', () => {
    expect(sanitizeCredential('bb_live_abc some_junk')).toBe('bb_live_abc');
  });
});

describe('warnApiKey', () => {
  it('returns null for plausible keys', () => {
    expect(warnApiKey('bb_live_' + 'a'.repeat(40))).toBeNull();
  });
  it('warns for short keys', () => {
    expect(warnApiKey('bb_live_short')).toMatch(/short/i);
  });
  it('warns for wrong prefix', () => {
    expect(warnApiKey('sk_live_' + 'a'.repeat(40))).toMatch(/bb_/);
  });
  it('returns null for empty', () => {
    expect(warnApiKey('')).toBeNull();
  });
});

describe('warnProjectId', () => {
  it('accepts UUIDs', () => {
    expect(warnProjectId('12345678-1234-1234-1234-123456789abc')).toBeNull();
  });
  it('warns for non-UUID', () => {
    expect(warnProjectId('not-a-uuid')).toMatch(/UUID/);
  });
  it('returns null for empty', () => {
    expect(warnProjectId('')).toBeNull();
  });
});