/**
 * useCloudFunctions — unit tests.
 *
 * The hook itself needs a React renderer, which this repo does not install.
 * We cover the non-render pieces directly:
 *   1. isEntityMissingError recognizes the real Base44 SDK 404 shape so we
 *      never mis-classify a normal HTTP error as "entity missing" and hide
 *      a feature that's just temporarily unreachable.
 *   2. The module-level cache exposed via __resetCloudFunctionsCacheForTests
 *      is in fact resetable between tests — every other CloudFunction test
 *      relies on this escape hatch to prevent the cross-test state bleed
 *      that would otherwise mask a regression.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The Base44 client module pulls real env + SDK on import (and reaches into
// window.location at the top level). Stub it so the helper module can load
// in a Node test environment.
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { CloudFunction: { list: vi.fn(), create: vi.fn() } } },
}));

const {
  isEntityMissingError,
  UNAVAILABLE_TTL_MS,
  __resetCloudFunctionsCacheForTests,
  __getUnavailableStateForTests,
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

  it('tolerates null / undefined without throwing', () => {
    expect(isEntityMissingError(null)).toBe(false);
    expect(isEntityMissingError(undefined)).toBe(false);
    expect(isEntityMissingError({})).toBe(false);
  });
});

describe('__resetCloudFunctionsCacheForTests', () => {
  it('is callable without arguments and without throwing', () => {
    expect(() => __resetCloudFunctionsCacheForTests()).not.toThrow();
  });
});

describe('UNAVAILABLE_TTL_MS', () => {
  beforeEach(() => {
    __resetCloudFunctionsCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetCloudFunctionsCacheForTests();
  });

  it('is exposed as a named constant so callers can align retry cadence', () => {
    // Five minutes is the deliberate default documented on the source. If we
    // ever shorten or lengthen it, both the hook and any downstream wait
    // heuristic need updating together — this test catches silent drift.
    expect(UNAVAILABLE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('has no unavailableAt until the reset is followed by a real broadcast', () => {
    expect(__getUnavailableStateForTests()).toEqual({ unavailable: false, unavailableAt: 0 });
  });
});
