/**
 * Fuzz tests for sanitizeCredential (#24).
 * Pipes random garbage in and asserts we never throw.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeCredential, warnApiKey, warnProjectId } from './credentialSanitize.js';

function randomString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_. "\'\t\n\r\u200B\u200C\uFEFF<>{}[]|\\`~!@#$%^&*()+=';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

describe('credential sanitize — fuzz', () => {
  it('never throws across 1000 random strings', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomString(Math.floor(Math.random() * 200));
      expect(() => sanitizeCredential(s)).not.toThrow();
      expect(() => warnApiKey(s)).not.toThrow();
      expect(() => warnProjectId(s)).not.toThrow();
    }
  });

  it('handles nullish / non-string without throwing', () => {
    const bad = [null, undefined, 0, false, true, {}, [], Symbol('x'), NaN, Infinity, -Infinity];
    for (const b of bad) {
      expect(() => sanitizeCredential(b)).not.toThrow();
      expect(() => warnApiKey(b)).not.toThrow();
      expect(() => warnProjectId(b)).not.toThrow();
    }
  });

  it('output never contains internal whitespace', () => {
    for (let i = 0; i < 100; i++) {
      const s = '  bb_live_' + randomString(20) + '\t\n' + randomString(10) + '  ';
      const cleaned = sanitizeCredential(s);
      expect(typeof cleaned).toBe('string');
      expect(cleaned).not.toMatch(/\s/);
    }
  });
});