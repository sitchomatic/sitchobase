/**
 * Synthetic finger-movement traces for AU Casino stealth.
 *
 * Before tapping a target element, simulates 2–3 intermediate
 * pointermove / touchmove events along a quadratic Bézier curve
 * from a random screen position to the element center. Real fingers
 * leave a motion trail; bots teleport.
 */
import { evaluate, wait } from '@/lib/authorizedBulkCdp';

const MIN_STEPS = 2;
const MAX_STEPS = 3;
const STEP_DELAY_MS = 15; // ~60fps cadence

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Generate points along a quadratic Bézier: P0 → control → P1.
 */
function bezierPoints(x0, y0, x1, y1, steps) {
  // Random control point offset to make the curve organic
  const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * 120;
  const cy = (y0 + y1) / 2 + (Math.random() - 0.5) * 120;
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const inv = 1 - t;
    pts.push({
      x: Math.round(inv * inv * x0 + 2 * inv * t * cx + t * t * x1),
      y: Math.round(inv * inv * y0 + 2 * inv * t * cy + t * t * y1),
    });
  }
  return pts;
}

/**
 * Build a JS script that reads an element's bounding rect center.
 */
function buildGetCenterScript(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`;
}

/**
 * Dispatch CDP Input.dispatchTouchEvent for a single move point.
 */
async function cdpTouchMove(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y }],
  }).catch(() => {});
}

/**
 * Simulate a finger sliding from a random origin to `selector`'s center
 * along a Bézier curve, dispatching 2–3 intermediate touch/pointer moves.
 *
 * Call this BEFORE humanType / tap to leave a motion trail.
 */
export async function tracePathTo(cdp, selector, signal) {
  const center = await evaluate(cdp, buildGetCenterScript(selector));
  if (!center) return;

  const steps = randInt(MIN_STEPS, MAX_STEPS);
  // Random start point — somewhere on-screen but away from the target
  const startX = randInt(20, 390);
  const startY = randInt(center.y - 200, center.y + 200);
  const points = bezierPoints(startX, startY, center.x, center.y, steps);

  // Start the touch sequence
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  }).catch(() => {});

  for (const pt of points) {
    if (signal?.aborted) break;
    await cdpTouchMove(cdp, pt.x, pt.y);
    await wait(STEP_DELAY_MS, signal).catch(() => {});
  }

  // End the touch at the element center
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: center.x, y: center.y }],
  }).catch(() => {});
}