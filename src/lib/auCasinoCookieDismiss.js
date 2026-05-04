/**
 * Cookie-banner dismissal for Joe Fortune & Ignition.
 *
 * GOAL.md §Phase 4 calls for site-specific selectors plus a generic
 * fallback list. We try site-specific first (highest precision) then
 * the generic list (broad coverage). All matching is best-effort —
 * if no banner is found we silently move on; the form-detection step
 * later doesn't depend on this succeeding.
 */

const SITE_SELECTORS = {
  joefortune: [
    '#cookie-accept',
    'button[aria-label*="accept" i]',
    'button[data-testid*="cookie" i]',
  ],
  ignition: [
    '#onetrust-accept-btn-handler',
    'button[aria-label*="accept" i]',
    '.ot-sdk-button',
  ],
};

const GENERIC_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#truste-consent-button',
  '#cookie-accept',
  '#cookie-accept-all',
  '#accept-cookies',
  '#acceptCookies',
  '#accept-all-cookies',
  '.cookie-accept',
  '.cookie-accept-all',
  '.accept-cookies',
  '.accept-all-cookies',
  'button[aria-label*="accept all" i]',
  'button[aria-label*="accept cookies" i]',
  'button[aria-label*="accept" i]',
  'button[data-testid*="accept-cookies" i]',
  'button[data-testid*="cookie-accept" i]',
  'button[data-cy*="accept" i]',
  'button[id*="accept" i][id*="cookie" i]',
  'button[class*="accept" i][class*="cookie" i]',
  '[role="dialog"] button:nth-of-type(1)',
  '[role="alertdialog"] button:nth-of-type(1)',
  '.cc-allow',
  '.cc-dismiss',
  '.cookie-consent button',
  '#cookie-banner button',
];

/**
 * Build a CDP `Runtime.evaluate` script that clicks the first matching
 * cookie banner button and returns which selector matched (for logs).
 */
export function buildCookieDismissScript(targetKey) {
  const siteSpecific = SITE_SELECTORS[targetKey] || [];
  const all = [...siteSpecific, ...GENERIC_SELECTORS];
  return `(() => {
    const selectors = ${JSON.stringify(all)};
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return { dismissed: true, selector: sel };
        }
      } catch (_) {}
    }
    return { dismissed: false, selector: null };
  })()`;
}