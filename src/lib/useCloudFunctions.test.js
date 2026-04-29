/**
 * useCloudFunctions — unit tests.
 *
 * The hook itself needs a React renderer, which this repo does not install.
 * We cover all non-render pieces directly through the exported helpers and
 * test-only escape hatches:
 *   1. isEntityMissingError — recognizes the real Base44 SDK 404 shape so we
 *      never mis-classify a normal HTTP error as "entity missing".
 *   2. normalizeSavePayload — input validation; size + length limits.
 *   3. Module-level cache resetability — every other test relies on this.
 *   4. UNAVAILABLE_TTL_MS — guard against silent drift from the documented
 *      5 minute default.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      CloudFunction: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
}));

const {
  isEntityMissingError,
  normalizeSavePayload,
  UNAVAILABLE_TTL_MS,
  MAX_SCRIPT_SIZE,
  MAX_NAME_LENGTH,
  __resetCloudFunctionsCacheForTests,
  __getUnavailableStateForTests,
  __getInFlightSavesSizeForTests,
} = await import('./useCloudFunctions');

describe('isEntityMissingError', () => {
  it('matches the real Base44 SDK 404 message shape seen on /stagehand', () => {
    expect(isEntityMissingError({
      message: '[Base44 SDK Error] 404: Entity schema CloudFunction not found in app',
    })).toBe(true);
  });

  it('matches explicit status 404 on the error or its response', () => {
    expect(isEntityMissingError({ status: 404 })).toBe(true);
    expect(isEntityMissingError({ response: { status: 404 } })).toBe(true);
  });

  it('matches a 404 embedded anywhere in the message string', () => {
    expect(isEntityMissingError({ message: 'Request failed with status code 404' })).toBe(true);
  });

  it('returns false for non-404 errors so transient failures do not disable the feature', () => {
    expect(isEntityMissingError({ status: 500 })).toBe(false);
    expect(isEntityMissingError({ message: 'network timeout' })).toBe(false);
    expect(isEntityMissingError({ response: { status: 401 } })).toBe(false);
  });

  it('tolerates null / undefined / empty without throwing', () => {
    expect(isEntityMissingError(null)).toBe(false);
    expect(isEntityMissingError(undefined)).toBe(false);
    expect(isEntityMissingError({})).toBe(false);
  });
});

describe('normalizeSavePayload', () => {
  it('trims name and script and defaults runtime to playwright', () => {
    const out = normalizeSavePayload({ name: '  hello  ', script: '  do thing  ' });
    expect(out).toEqual({ name: 'hello', script: 'do thing', description: undefined, runtime: 'playwright' });
  });

  it('keeps a provided description (trimmed) and runtime', () => {
    const out = normalizeSavePayload({ name: 'a', script: 'b', description: '  desc  ', runtime: 'puppeteer' });
    expect(out.description).toBe('desc');
    expect(out.runtime).toBe('puppeteer');
  });

  it('strips empty descriptions', () => {
    expect(normalizeSavePayload({ name: 'a', script: 'b', description: '   ' }).description).toBeUndefined();
  });

  it('rejects empty name', () => {
    expect(() => normalizeSavePayload({ name: '', script: 'b' })).toThrow(/name is required/i);
    expect(() => normalizeSavePayload({ name: '   ', script: 'b' })).toThrow(/name is required/i);
  });

  it('rejects empty script', () => {
    expect(() => normalizeSavePayload({ name: 'a', script: '' })).toThrow(/script is required/i);
    expect(() => normalizeSavePayload({ name: 'a', script: '   ' })).toThrow(/script is required/i);
  });

  it('rejects oversized name', () => {
    const longName = 'a'.repeat(MAX_NAME_LENGTH + 1);
    expect(() => normalizeSavePayload({ name: longName, script: 'b' })).toThrow(/≤/);
  });

  it('rejects oversized script', () => {
    const longScript = 'a'.repeat(MAX_SCRIPT_SIZE + 1);
    expect(() => normalizeSavePayload({ name: 'a', script: longScript })).toThrow(/KB/);
  });

  it('accepts script exactly at the size limit', () => {
    const okScript = 'a'.repeat(MAX_SCRIPT_SIZE);
    expect(() => normalizeSavePayload({ name: 'a', script: okScript })).not.toThrow();
  });

  it('rejects unsupported runtime values', () => {
    expect(() => normalizeSavePayload({ name: 'a', script: 'b', runtime: 'selenium' })).toThrow(/Unsupported runtime/);
  });

  it('accepts each supported runtime', () => {
    for (const r of ['playwright', 'puppeteer', 'stagehand']) {
      expect(normalizeSavePayload({ name: 'a', script: 'b', runtime: r }).runtime).toBe(r);
    }
  });

  it('coerces non-string inputs gracefully', () => {
    expect(() => normalizeSavePayload({ name: null, script: 'b' })).toThrow(/name is required/i);
    expect(() => normalizeSavePayload({ name: 'a', script: null })).toThrow(/script is required/i);
    expect(() => normalizeSavePayload(null)).toThrow(/name is required/i);
    expect(() => normalizeSavePayload(undefined)).toThrow(/name is required/i);
  });

  it('falls back to playwright when runtime is empty/falsy', () => {
    expect(normalizeSavePayload({ name: 'a', script: 'b', runtime: '' }).runtime).toBe('playwright');
    expect(normalizeSavePayload({ name: 'a', script: 'b', runtime: undefined }).runtime).toBe('playwright');
  });
});

describe('__resetCloudFunctionsCacheForTests', () => {
  beforeEach(() => __resetCloudFunctionsCacheForTests());
  afterEach(() => __resetCloudFunctionsCacheForTests());

  it('is callable without arguments and without throwing', () => {
    expect(() => __resetCloudFunctionsCacheForTests()).not.toThrow();
  });

  it('clears in-flight saves bookkeeping', () => {
    expect(__getInFlightSavesSizeForTests()).toBe(0);
  });
});

describe('UNAVAILABLE_TTL_MS', () => {
  beforeEach(() => __resetCloudFunctionsCacheForTests());
  afterEach(() => {
    vi.useRealTimers();
    __resetCloudFunctionsCacheForTests();
  });

  it('is exposed as a named constant so callers can align retry cadence', () => {
    expect(UNAVAILABLE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('has no unavailableAt until a real broadcast', () => {
    expect(__getUnavailableStateForTests()).toEqual({ unavailable: false, unavailableAt: 0 });
  });
});

describe('Size constants', () => {
  it('MAX_SCRIPT_SIZE is 64KB', () => {
    expect(MAX_SCRIPT_SIZE).toBe(64 * 1024);
  });
  it('MAX_NAME_LENGTH is 120', () => {
    expect(MAX_NAME_LENGTH).toBe(120);
  });
});