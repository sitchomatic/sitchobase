/**
 * Shared page/panel transition timing.
 *
 * Single source of truth so every framer-motion transition in the app moves
 * at the same speed + easing curve. Also respects the OS
 * `prefers-reduced-motion` setting — when on, slide offsets collapse to 0
 * so only an opacity cross-fade remains (WCAG 2.1 permits cross-fades).
 */

// Slightly longer than the old 0.18s so the ease curve is readable at 60fps
// on low-powered devices, but still well under the ~250ms perceptual ceiling
// where transitions start to feel sluggish.
export const TRANSITION_DURATION_S = 0.22;

// cubic-bezier equivalent of framer-motion's `easeOut` — pulled out so we can
// hand the same curve to non-framer surfaces (CSS, WAAPI) if needed.
export const TRANSITION_EASE = [0.25, 0.46, 0.45, 0.94];

/**
 * True when the OS / browser is set to minimize motion. SSR-safe: falls back
 * to `false` when `window.matchMedia` isn't available.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Canonical `transition` prop for framer-motion slide+fade page/panel
 * transitions. Under reduced motion the x-offsets in the variant helpers are
 * already collapsed to 0, so only an opacity cross-fade remains. We keep the
 * normal duration so that fade is still smooth — WCAG 2.1 only asks us to
 * remove vestibular-triggering motion (translation, parallax, zoom), not
 * cross-fades.
 */
export function pageTransition() {
  return { duration: TRANSITION_DURATION_S, ease: TRANSITION_EASE };
}

/**
 * Canonical initial/animate/exit variants for left/right slide-in panels
 * (session detail, audit drawer). The x-offset collapses to 0 under
 * reduced motion so the panel appears instantly with no slide.
 */
export function slideInVariants({
  offset = 32,
  direction = 'right',
  reducedMotion,
} = {}) {
  const reduce = reducedMotion ?? prefersReducedMotion();
  const x = reduce ? 0 : (direction === 'left' ? -offset : offset);
  return {
    initial: { x, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    // Slide back out the same way it came in.
    exit: { x, opacity: 0 },
  };
}

/**
 * Variants for the top-level route/page transition (slight right-shift on
 * enter, left on exit). Matches the pre-existing AppLayout behaviour but
 * sourced from one place.
 */
export function pageVariants({ offset = 24, reducedMotion } = {}) {
  const reduce = reducedMotion ?? prefersReducedMotion();
  if (reduce) {
    return {
      initial: { x: 0, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 0, opacity: 0 },
    };
  }
  return {
    initial: { x: offset, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -offset, opacity: 0 },
  };
}
