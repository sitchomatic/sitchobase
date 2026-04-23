/**
 * Sanitization + shape validation for Browserbase credentials.
 *
 * Built to handle real-world paste failure modes: quotes from code snippets,
 * `Bearer ` prefixes from curl docs, zero-width characters from chat apps,
 * whitespace, newlines, and accidental env-var names (`API_KEY=bb_live_…`).
 */

// Zero-width + BOM characters that sneak in via copy-paste
const INVISIBLE = /[\u200B-\u200D\uFEFF\u00A0]/g;

/**
 * Normalize any pasted string to a clean credential token.
 * Never throws — always returns a string.
 */
export function sanitizeCredential(raw) {
  if (raw == null) return '';
  let v = String(raw);

  // Strip invisibles, normalize whitespace, collapse newlines
  v = v.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

  // Strip surrounding quotes: "abc", 'abc', `abc`
  if (v.length >= 2) {
    const first = v[0], last = v[v.length - 1];
    if ((first === '"' || first === "'" || first === '`') && first === last) {
      v = v.slice(1, -1).trim();
    }
  }

  // Strip `Bearer ` prefix (case-insensitive)
  v = v.replace(/^bearer\s+/i, '');

  // Strip `KEY=` or `KEY:` prefix from pasted env lines (e.g. `BROWSERBASE_API_KEY=bb_live_…`)
  const eqMatch = v.match(/^[A-Za-z_][A-Za-z0-9_]*\s*[=:]\s*(.+)$/);
  if (eqMatch) v = eqMatch[1].trim();

  // Strip quotes again in case the env line had them inside
  if (v.length >= 2) {
    const first = v[0], last = v[v.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      v = v.slice(1, -1).trim();
    }
  }

  // No internal whitespace allowed in tokens — take the first word
  if (/\s/.test(v)) v = v.split(/\s/)[0];

  return v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Non-blocking warning if the API key doesn't look like a Browserbase key. */
export function warnApiKey(value) {
  if (!value) return null;
  if (value.length < 20) return 'Looks too short — Browserbase keys are typically 40+ characters.';
  if (!/^bb_/i.test(value)) return 'Expected to start with "bb_live_" or "bb_test_". Double-check you copied the full key.';
  return null;
}

/** Non-blocking warning if the Project ID isn't a UUID. */
export function warnProjectId(value) {
  if (!value) return null;
  if (!UUID_RE.test(value)) return 'Expected a UUID like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.';
  return null;
}