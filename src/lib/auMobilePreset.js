/**
 * AU Mobile preset — adapted from the `au-proxy-fleet` reference script.
 * Applies iPhone UA, mobile viewport, en-AU locale, and ap-southeast-1 region
 * to a Browserbase session config. Opt-in via the JoeIgnite settings.
 */

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

/** Merge AU-mobile session options into an existing BB session options object. */
export function applyAuMobilePreset(sessionOpts) {
  const width = 390 + Math.floor(Math.random() * 25);
  const height = 844 + Math.floor(Math.random() * 40);
  return {
    ...sessionOpts,
    region: 'ap-southeast-1',
    browserSettings: {
      ...(sessionOpts.browserSettings || {}),
      viewport: { width, height },
      fingerprint: {
        ...(sessionOpts.browserSettings?.fingerprint || {}),
        devices: ['mobile'],
        locales: ['en-AU', 'en-GB', 'en'],
      },
    },
  };
}

/** Init script to override UA + Accept-Language at the page level (belt & braces). */
export const AU_MOBILE_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'userAgent', { get: () => ${JSON.stringify(IPHONE_UA)} });
  Object.defineProperty(navigator, 'language', { get: () => 'en-AU' });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-AU','en-GB','en'] });
`;

/** Pre-formatted HTTPS proxy fleet from the AU reference script. */
export const AU_HTTPS_FLEET = {
  host: '139.99.149.194',
  username: 'jfrdep',
  password: 'YDKA7diPyz',
  ports: [
    10326, 10327, 10328, 10329, 10330, 10331, 10332, 10333, 10334, 10335,
    10336, 10337, 10338, 10339, 10340, 10341, 10342, 10343, 10362, 10363,
    10364, 10365, 10366, 10367, 10371, 10373, 10374, 10375, 10376, 10377,
  ],
};

export function buildAuHttpsFleetText() {
  const { host, username, password, ports } = AU_HTTPS_FLEET;
  return ports.map((p) => `${host}:${p}:${username}:${password}`).join('\n');
}