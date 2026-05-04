/**
 * Session-level stealth hardening for AU Casino automation.
 *
 * Injected via CDP before any page navigation. Each function patches a
 * specific browser API fingerprint vector to make the session look like
 * a real Android Chrome user rather than a headless bot.
 *
 * All scripts are injected via Page.addScriptToEvaluateOnNewDocument so
 * they persist across same-origin navigations (warm-up → login).
 */

/* ------------------------------------------------------------------ */
/*  1. Referer spoofing                                                */
/* ------------------------------------------------------------------ */
const REFERERS = [
  'https://www.google.com.au/',
  'https://www.google.com/search?q=joe+fortune+login',
  'https://www.google.com/search?q=ignition+casino+login',
  'https://www.google.com.au/search?q=online+casino+australia',
  '', // direct / bookmarked — some users do this
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRefererScript() {
  const ref = pick(REFERERS);
  if (!ref) return null; // leave blank referrer as-is
  return `Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => ${JSON.stringify(ref)},
  });`;
}

/* ------------------------------------------------------------------ */
/*  2. Canvas / WebGL noise injection                                  */
/* ------------------------------------------------------------------ */
function buildCanvasNoiseScript() {
  return `(() => {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const noise = () => (Math.random() - 0.5) * 2; // ±1 per channel

    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {
        const img = origGetImageData.call(ctx, 0, 0, 1, 1);
        img.data[0] = Math.max(0, Math.min(255, img.data[0] + noise()));
        ctx.putImageData(img, 0, 0);
      }
      return origToDataURL.apply(this, args);
    };

    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const data = origGetImageData.apply(this, args);
      if (data.data.length >= 4) {
        data.data[0] = Math.max(0, Math.min(255, data.data[0] + noise()));
      }
      return data;
    };
  })();`;
}

/* ------------------------------------------------------------------ */
/*  3. Battery API spoofing                                            */
/* ------------------------------------------------------------------ */
function buildBatteryScript() {
  const level = 0.4 + Math.random() * 0.45; // 40–85%
  const charging = Math.random() > 0.5;
  return `(() => {
    const battery = {
      charging: ${charging},
      chargingTime: ${charging ? Math.floor(600 + Math.random() * 3000) : 'Infinity'},
      dischargingTime: ${!charging ? Math.floor(3600 + Math.random() * 14400) : 'Infinity'},
      level: ${level.toFixed(2)},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
    navigator.getBattery = () => Promise.resolve(battery);
  })();`;
}

/* ------------------------------------------------------------------ */
/*  4. Network Information API spoofing                                */
/* ------------------------------------------------------------------ */
function buildNetworkInfoScript() {
  const types = ['wifi', '4g'];
  const effectiveType = pick(types);
  const downlink = effectiveType === 'wifi' ? (20 + Math.random() * 80).toFixed(1) : (5 + Math.random() * 15).toFixed(1);
  const rtt = effectiveType === 'wifi' ? Math.floor(10 + Math.random() * 40) : Math.floor(50 + Math.random() * 100);
  return `(() => {
    if (!navigator.connection) {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: ${JSON.stringify(effectiveType)},
          downlink: ${downlink},
          rtt: ${rtt},
          saveData: false,
          type: ${JSON.stringify(effectiveType === 'wifi' ? 'wifi' : 'cellular')},
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        writable: false,
        configurable: true,
      });
    }
  })();`;
}

/* ------------------------------------------------------------------ */
/*  5. Tab visibility toggling (fires during warm-up dwell)            */
/* ------------------------------------------------------------------ */
export function buildVisibilityToggleScript() {
  // Fires a brief hidden→visible cycle like a user switching apps.
  // Randomized delay (200–800ms hidden) to avoid patterns.
  const hiddenMs = 200 + Math.floor(Math.random() * 600);
  return `(() => {
    const orig = document.visibilityState;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    setTimeout(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    }, ${hiddenMs});
  })();`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Inject all stealth patches into a CDP session via
 * Page.addScriptToEvaluateOnNewDocument. Call once right after
 * Page.enable / Runtime.enable, before any navigation.
 */
export async function injectStealthScripts(cdp) {
  const scripts = [
    buildCanvasNoiseScript(),
    buildBatteryScript(),
    buildNetworkInfoScript(),
  ];
  const refScript = buildRefererScript();
  if (refScript) scripts.push(refScript);

  for (const source of scripts) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }
}