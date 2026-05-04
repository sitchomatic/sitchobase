/**
 * Password-attempt sequence builder for the dual-target validator.
 *
 * Implements GOAL.md §"Password Retry Logic":
 *
 *   Path A (CSV provides alt passwords in columns C/D):
 *     [password, password2, password3, password3]
 *
 *   Path B (no alt passwords):
 *     [password, password!, password!!, password!!]
 *
 * The 4th attempt is always a deliberate re-press of the 3rd password.
 * This is the buffer attempt that reliably triggers the "temporarily
 * disabled" response — server-side counters sometimes miss attempt #3
 * due to network drops, so we replay it.
 */

/**
 * @param {{password?: string, password2?: string, password3?: string}} row
 * @returns {{ passwords: string[], path: 'A'|'B', repeatLastIndex: number }}
 *   `repeatLastIndex` is the index whose attempt is replayed in slot 3.
 *   The runner uses it to decide "re-press submit only" vs "clear + retype".
 */
export function buildAttemptSequence(row) {
  const base = (row?.password || '').toString();
  const alt2 = (row?.password2 || '').toString();
  const alt3 = (row?.password3 || '').toString();
  const hasAlts = alt2.length > 0 || alt3.length > 0;

  if (hasAlts) {
    const p2 = alt2 || base;
    const p3 = alt3 || alt2 || base;
    return { passwords: [base, p2, p3, p3], path: 'A', repeatLastIndex: 2 };
  }

  // Path B: append a bang per attempt — same shape, no real password is
  // expected to match. Goal is purely to drive the failure counter.
  return {
    passwords: [base, `${base}!`, `${base}!!`, `${base}!!`],
    path: 'B',
    repeatLastIndex: 2,
  };
}

/**
 * CSV column normaliser — extends the existing `normalizeBulkRows`
 * vocabulary with the alt-password columns from GOAL.md.
 *
 * Accepts loose header naming so CSVs from different sources still parse:
 *   password   | pw   | pwd
 *   password2  | pw2  | alt_password | password_2
 *   password3  | pw3  | alt_password2 | password_3
 */
const PASSWORD2_KEYS = ['password2', 'pw2', 'alt_password', 'password_2'];
const PASSWORD3_KEYS = ['password3', 'pw3', 'alt_password2', 'password_3'];

function pickField(rawRow, keys) {
  if (!rawRow || typeof rawRow !== 'object') return '';
  // Case-insensitive lookup against the row's keys.
  const lowered = {};
  for (const [k, v] of Object.entries(rawRow)) lowered[k.toLowerCase()] = v;
  for (const key of keys) {
    const v = lowered[key];
    if (typeof v === 'string' && v.length) return v;
  }
  return '';
}

/** Pull `password2` / `password3` off a raw CSV row, if present. */
export function extractAltPasswords(rawRow) {
  return {
    password2: pickField(rawRow, PASSWORD2_KEYS),
    password3: pickField(rawRow, PASSWORD3_KEYS),
  };
}