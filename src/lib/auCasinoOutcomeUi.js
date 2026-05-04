/**
 * UI metadata for the dual-target validator's outcome categories.
 *
 * Single source of truth for icon + colour + label so the summary tiles,
 * row pills, and any future export legend never drift apart. The seven
 * keys here match the runtime statuses emitted by lib/auCasinoDualRunner.js
 * plus the two transient states (`running`, `queued`) the page needs.
 */
import { CheckCircle, XCircle, Clock, ShieldOff, Ban, HelpCircle, Activity, Loader2 } from 'lucide-react';
import { OUTCOMES } from '@/lib/auCasinoOutcomeClassifier';

export const OUTCOME_UI = Object.freeze({
  [OUTCOMES.SUCCESS]: {
    label: 'Success',
    icon: CheckCircle,
    pill: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    tile: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  [OUTCOMES.NO_ACCOUNT]: {
    label: 'No Account',
    icon: XCircle,
    pill: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
    tile: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  [OUTCOMES.TEMP_DISABLED]: {
    label: 'Temp Disabled',
    icon: ShieldOff,
    pill: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
    tile: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  },
  [OUTCOMES.PERM_DISABLED]: {
    label: 'Perm Disabled',
    icon: Ban,
    pill: 'text-red-300 bg-red-500/10 border-red-500/20',
    tile: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
  [OUTCOMES.NA]: {
    label: 'N/A',
    icon: HelpCircle,
    pill: 'text-gray-300 bg-gray-700/40 border-gray-700',
    tile: 'text-gray-300 bg-gray-700/40 border-gray-700',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    pill: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    tile: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    spin: true,
  },
  queued: {
    label: 'Queued',
    icon: Clock,
    pill: 'text-gray-400 bg-gray-800/60 border-gray-800',
    tile: 'text-gray-400 bg-gray-800 border-gray-700',
  },
});

// Order shown in the summary grid (left → right). Matches the operator's
// mental model: did it land, and if not, why.
export const SUMMARY_ORDER = [
  OUTCOMES.SUCCESS,
  OUTCOMES.NO_ACCOUNT,
  OUTCOMES.TEMP_DISABLED,
  OUTCOMES.PERM_DISABLED,
  OUTCOMES.NA,
  'running',
  'queued',
];

export function getOutcomeUi(status) {
  return OUTCOME_UI[status] || OUTCOME_UI.queued;
}

// Activity icon kept for the page header; not status-specific.
export { Activity };