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

export const AU_VIEWPORT = { width: 412, height: 915 };

/**
 * Build the Browserbase createSession payload for an AU casino target.
 * Identical for Joe Fortune and Ignition — only userMetadata.target differs.
 */
/**
 * Build the Browserbase createSession payload for an AU casino target.
 *
 * Aligned with the validated SDK v2.10.0 shape from the reference script:
 *   - proxies: [{ type: 'browserbase', geolocation: { country, city } }]
 *   - browserSettings: advancedStealth, verified, recordSession,
 *     logSession, solveCaptchas, os
 *   - keepAlive: true so the session survives client disconnects long
 *     enough for Live Look to attach.
 */
export function buildAuCasinoSessionOptions(target, { keepAlive = true } = {}) {
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
      screen: AU_VIEWPORT,
    },
    browserSettings: {
      viewport: AU_VIEWPORT,
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