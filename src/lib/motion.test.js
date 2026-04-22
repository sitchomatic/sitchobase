import { describe, it, expect, afterEach } from 'vitest';
import {
  TRANSITION_DURATION_S,
  TRANSITION_EASE,
  pageTransition,
  pageVariants,
  slideInVariants,
  prefersReducedMotion,
} from './motion';

// These tests run under the node environment (see vitest.config.js) so
// `window` is undefined by default — perfect for asserting the SSR-safe
// fallback. Individual tests install a window.matchMedia stub where needed.
function installMatchMedia(reduce) {
  globalThis.window = {
    matchMedia: (query) => ({
      matches: query.includes('reduce') && reduce,
      media: query,
    }),
  };
}

afterEach(() => {
  delete globalThis.window;
});

describe('prefersReducedMotion', () => {
  it('returns false when window is undefined (Node / SSR)', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when the OS media query matches', () => {
    installMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when the OS media query does not match', () => {
    installMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns false when matchMedia throws', () => {
    globalThis.window = { matchMedia: () => { throw new Error('nope'); } };
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('pageTransition', () => {
  it('always returns the canonical duration + ease', () => {
    expect(pageTransition()).toEqual({
      duration: TRANSITION_DURATION_S,
      ease: TRANSITION_EASE,
    });
  });

  it('returns the same value even when the OS prefers reduced motion (slides are suppressed in variants, not here)', () => {
    installMatchMedia(true);
    // pageTransition does not read prefersReducedMotion(); the x-offsets in
    // pageVariants / slideInVariants collapse to 0 instead, preserving the fade.
    expect(pageTransition()).toEqual({
      duration: TRANSITION_DURATION_S,
      ease: TRANSITION_EASE,
    });
  });
});

describe('pageVariants', () => {
  it('applies the default 24px slide offset', () => {
    const v = pageVariants();
    expect(v.initial).toEqual({ x: 24, opacity: 0 });
    expect(v.animate).toEqual({ x: 0, opacity: 1 });
    expect(v.exit).toEqual({ x: -24, opacity: 0 });
  });

  it('respects a custom offset', () => {
    const v = pageVariants({ offset: 40 });
    expect(v.initial.x).toBe(40);
    expect(v.exit.x).toBe(-40);
  });

  it('flattens the x-offset under reduced motion', () => {
    const v = pageVariants({ reducedMotion: true });
    expect(v.initial.x).toBe(0);
    expect(v.exit.x).toBe(0);
    // Opacity fade should also be zero-time via pageTransition(), but
    // keeping an opacity change here is fine — reduced motion cares about
    // movement, not cross-fade.
    expect(v.initial.opacity).toBe(0);
    expect(v.animate.opacity).toBe(1);
  });
});

describe('slideInVariants', () => {
  it('slides in from the right by default', () => {
    const v = slideInVariants();
    expect(v.initial).toEqual({ x: 32, opacity: 0 });
    expect(v.exit).toEqual({ x: 32, opacity: 0 });
  });

  it('slides in from the left when direction="left"', () => {
    const v = slideInVariants({ direction: 'left' });
    expect(v.initial.x).toBe(-32);
    expect(v.exit.x).toBe(-32);
  });

  it('collapses x offset under reduced motion', () => {
    const v = slideInVariants({ reducedMotion: true });
    expect(v.initial.x).toBe(0);
    expect(v.exit.x).toBe(0);
  });
});
