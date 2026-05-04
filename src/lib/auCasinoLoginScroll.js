/**
 * Random pre-login scroll on the login page.
 *
 * After the login page loads but before interacting with the form,
 * scrolls down a random amount (150–400px) as if reading promo banners
 * or T&C, pauses briefly, then scrolls back to the top. Instant form
 * interaction without any scroll is a bot tell.
 */
import { evaluate, wait } from '@/lib/authorizedBulkCdp';

const MIN_SCROLL = 150;
const MAX_SCROLL = 400;
const MIN_DWELL_MS = 500;
const MAX_DWELL_MS = 1_500;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export async function preLoginScroll(cdp, signal) {
  const scrollY = randInt(MIN_SCROLL, MAX_SCROLL);
  const dwell = randInt(MIN_DWELL_MS, MAX_DWELL_MS);

  // Scroll down
  await evaluate(cdp, `window.scrollTo({ top: ${scrollY}, behavior: 'smooth' })`).catch(() => null);
  await wait(dwell, signal).catch(() => {});

  // Scroll back up to the form
  await evaluate(cdp, `window.scrollTo({ top: 0, behavior: 'smooth' })`).catch(() => null);
  await wait(300, signal).catch(() => {});
}