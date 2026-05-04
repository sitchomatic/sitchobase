/**
 * Pre-flight warm-up navigation for AU Casino sessions.
 *
 * Before heading straight to the login page, visits a neutral page on the
 * same domain (FAQ, promotions, about) for a randomized dwell time. This
 * mimics natural user behaviour — real visitors rarely land directly on
 * /login — and builds a small navigation history + cookie trail that
 * makes the session look organic to bot-detection systems.
 *
 * Each target defines a set of candidate warm-up URLs; one is picked at
 * random per session. The dwell time is 2–5 seconds (randomized).
 */
import { evaluate, wait, waitForPageIdle } from '@/lib/authorizedBulkCdp';
import { buildVisibilityToggleScript } from '@/lib/auCasinoStealth';

const MIN_DWELL_MS = 2_000;
const MAX_DWELL_MS = 5_000;

function dwellTime() {
  return MIN_DWELL_MS + Math.floor(Math.random() * (MAX_DWELL_MS - MIN_DWELL_MS + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Neutral pages per target. These are public, low-risk pages on the same
 * domain that don't require authentication. Update if the sites change
 * their URL structure.
 */
const WARMUP_URLS = {
  joefortune: [
    'https://www.joefortune.com/promotions',
    'https://www.joefortune.com/faq',
    'https://www.joefortune.com/about',
    'https://www.joefortune.com/',
  ],
  ignition: [
    'https://www.ignitioncasino.eu/promotions',
    'https://www.ignitioncasino.eu/faq',
    'https://www.ignitioncasino.eu/about-us',
    'https://www.ignitioncasino.eu/',
  ],
};

/**
 * Small random scroll to simulate a user glancing at the warm-up page.
 */
function buildScrollScript() {
  const scrollY = 100 + Math.floor(Math.random() * 400); // 100–500px
  return `window.scrollTo({ top: ${scrollY}, behavior: 'smooth' })`;
}

/**
 * Run the pre-flight step: navigate to a random neutral page, dwell for
 * 2–5s with a small scroll, then return. The caller navigates to the
 * login page afterwards.
 *
 * @param {object} cdp    - CDP connection
 * @param {object} target - AU_CASINO_TARGETS entry (has .key)
 * @param {AbortSignal} signal - abort signal
 * @returns {{ url: string, dwellMs: number }} what was visited and for how long
 */
export async function runPreflight(cdp, target, signal) {
  const candidates = WARMUP_URLS[target.key] || WARMUP_URLS.joefortune;
  const url = pick(candidates);
  const dwell = dwellTime();

  await cdp.send('Page.navigate', { url });
  await waitForPageIdle(cdp, signal);

  // Small scroll to leave a scroll-depth footprint
  await evaluate(cdp, buildScrollScript()).catch(() => null);

  // Tab visibility toggle — briefly "switch apps" like a real mobile user
  await evaluate(cdp, buildVisibilityToggleScript()).catch(() => null);

  await wait(dwell, signal).catch(() => {});

  return { url, dwellMs: dwell };
}