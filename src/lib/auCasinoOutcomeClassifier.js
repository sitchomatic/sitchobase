/**
 * Per-attempt outcome classifier for the AU Casino dual-target validator.
 *
 * Implements the page-content rules from GOAL.md §Phase 6:
 *   - "been disabled"          → permdisabled  (account permanently disabled)
 *   - "temporarily disabled"   → tempdisabled  (account exists; 1hr cooldown)
 *   - "incorrect"              → retry         (try next password in sequence)
 *   - none of the above        → success       (login appears to have worked)
 *
 * Returned shape is intentionally tiny so the runner can switch on `kind`
 * without parsing free-text outcomes.
 */

// Five terminal categories from GOAL.md "Result Categories" table, plus
// `retry` which is internal to the 4-attempt loop and never persisted.
export const OUTCOMES = Object.freeze({
  SUCCESS: 'success',
  NO_ACCOUNT: 'noaccount',
  TEMP_DISABLED: 'tempdisabled',
  PERM_DISABLED: 'permdisabled',
  NA: 'na',
  RETRY: 'retry',
});

// Order matters — perm before temp because "been disabled" implies a
// stronger signal than "temporarily disabled" if both ever co-occur.
const SIGNALS = [
  { needle: 'been disabled', kind: OUTCOMES.PERM_DISABLED },
  { needle: 'temporarily disabled', kind: OUTCOMES.TEMP_DISABLED },
  { needle: 'incorrect', kind: OUTCOMES.RETRY },
];

/**
 * Classify a single login attempt from the page text it produced.
 * @param {{ text?: string, title?: string }} state
 * @returns {{ kind: string, signal: string|null }}
 */
export function classifyAttempt(state) {
  const haystack = `${state?.title || ''}\n${state?.text || ''}`.toLowerCase();
  for (const { needle, kind } of SIGNALS) {
    if (haystack.includes(needle)) return { kind, signal: needle };
  }
  return { kind: OUTCOMES.SUCCESS, signal: null };
}

/**
 * Map the loop result for a (row, target) pair to a terminal category.
 *
 * `attempts` is an ordered list of classifyAttempt() results. The rules:
 *   - any attempt classified as success         → success
 *   - any perm/temp disabled                    → that category
 *   - 4 attempts, all retry / no signal         → noaccount
 *   - error before any attempt completed        → na
 */
export function classifyTaskFromAttempts(attempts) {
  if (!attempts?.length) return { kind: OUTCOMES.NA };
  for (const a of attempts) {
    if (a.kind === OUTCOMES.PERM_DISABLED) return { kind: OUTCOMES.PERM_DISABLED };
    if (a.kind === OUTCOMES.TEMP_DISABLED) return { kind: OUTCOMES.TEMP_DISABLED };
    if (a.kind === OUTCOMES.SUCCESS) return { kind: OUTCOMES.SUCCESS };
  }
  // All 4 attempts came back `retry` (or empty) → email has no account.
  return { kind: OUTCOMES.NO_ACCOUNT };
}

/**
 * UI/CSV-friendly label for an outcome kind. Used by the dual-validation
 * page so summary cards and exports speak the same vocabulary.
 */
export function outcomeLabel(kind) {
  switch (kind) {
    case OUTCOMES.SUCCESS: return 'Success';
    case OUTCOMES.NO_ACCOUNT: return 'No Account';
    case OUTCOMES.TEMP_DISABLED: return 'Temp Disabled';
    case OUTCOMES.PERM_DISABLED: return 'Perm Disabled';
    case OUTCOMES.NA: return 'N/A';
    default: return kind || 'Unknown';
  }
}