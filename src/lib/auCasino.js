/**
 * AU Casino preset — opinionated configuration for Australian users running
 * Joe Fortune and Ignition Casino simultaneously through Browserbase.
 *
 * Both sites use the same backend (Bovada/Pai Wow stack) but treat AU traffic
 * very differently from US traffic. Hitting them from a us-* region with a
 * desktop fingerprint produces tells the casinos use to flag automation:
 *  - non-AU IP geolocation
 *  - desktop UA hitting the AU mobile-redirected domain
 *  - default Browserbase locale/timezone (en-US, America/Los_Angeles)
 *
 * The shape exported here is the exact `options` object passed to
 * bbClient.createSession() — keeping the preset in one place so the
 * Dashboard quick-launch and the dedicated AU Casino page can't drift apart.
 */

// Per-site canonical selectors — taken from the validated reference script
// (Browserbase SDK v2.10.0 dual-target validator). The runner tries these
// first; if missing it falls back to broad heuristic selectors.
export const JOE_FORTUNE = {
  key: 'joefortune',
  label: 'Joe Fortune',
  url: 'https://www.joefortune.com/',
  loginUrl: 'https://www.joefortune.com/login',
  brandColor: 'amber',
  selectors: {
    username: '#username',
    password: '#password',
    submit: '#loginSubmit',
  },
};

export const IGNITION = {
  key: 'ignition',
  label: 'Ignition Casino',
  url: 'https://www.ignitioncasino.eu/',
  loginUrl: 'https://www.ignitioncasino.eu/login',
  brandColor: 'red',
  selectors: {
    username: '#email',
    password: '#login-password',
    submit: '#login-submit',
  },
};

export const AU_CASINO_TARGETS = [JOE_FORTUNE, IGNITION];

// Browserbase region nearest Australia. AU Smartproxy + ap-southeast-1 keeps
// the fingerprint plausibly Sydney/Melbourne origin.
export const AU_REGION = 'ap-southeast-1';

// Realistic AU mobile Chrome UA (Pixel 8 / Android 14) — matches what Joe
// Fortune and Ignition expect from .com.au handheld traffic. Pinned to a
// specific version because randomizing UA mid-session triggers their
// bot-detection. Update when Chrome stable rolls forward.
export const AU_MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';

export const AU_VIEWPORT_BASE = { width: 412, height: 915 };
/** @deprecated Use AU_VIEWPORT_BASE — kept for backward compat. */
export const AU_VIEWPORT = AU_VIEWPORT_BASE;

/**
 * Apply ±5–15px jitter to the base viewport dimensions so every session
 * has a slightly different resolution. Identical dimensions across
 * hundreds of sessions is a strong bot fingerprint.
 */
function jitteredViewport() {
  const jw = Math.floor((Math.random() - 0.5) * 2 * 15); // –15 to +15
  const jh = Math.floor((Math.random() - 0.5) * 2 * 15);
  return {
    width: AU_VIEWPORT_BASE.width + jw,
    height: AU_VIEWPORT_BASE.height + jh,
  };
}

/**
 * Build the Browserbase createSession payload for an AU casino target.
 *
 * Viewport dimensions are randomized ±15px per session to avoid
 * fingerprint clustering. All other settings follow the validated
 * SDK v2.10.0 shape.
 */
export function buildAuCasinoSessionOptions(target, { keepAlive = true } = {}) {
  const viewport = jitteredViewport();
  return {
    region: AU_REGION,
    keepAlive,
    timeout: 60,
    proxies: [
      {
        type: 'browserbase',
        geolocation: { country: 'AU', city: 'Melbourne' },
      },
    ],
    fingerprint: {
      devices: ['mobile'],
      locales: ['en-AU'],
      operatingSystems: ['android'],
      screen: viewport,
    },
    browserSettings: {
      viewport,
      blockAds: true,
      advancedStealth: true,
      verified: true,
      recordSession: true,
      logSession: true,
      solveCaptchas: true,
      os: 'android',
    },
    userMetadata: {
      target: target.key,
      targetLabel: target.label,
      targetUrl: target.url,
      preset: 'au-casino',
      launchedFrom: 'BBCommandCenter-AUCasino',
      country: 'AU',
      tz: 'Australia/Sydney',
    },
  };
}