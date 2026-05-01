import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { sessionInspectorUrl } from '@/lib/browserbaseUrls';
import {
  CheckCircle, XCircle, Lock, AlertTriangle, HelpCircle,
  RefreshCw, Save, Loader2, Trash2, Film, Eye, EyeOff, Flame,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { JOE_FORTUNE, IGNITION } from '@/lib/auCasino';

const STATUS_META = {
  valid:   { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Valid' },
  invalid: { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'Invalid' },
  locked:  { icon: Lock,          color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  label: 'Locked / Review' },
  error:   { icon: AlertTriangle, color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  label: 'Error' },
  unknown: { icon: HelpCircle,    color: 'text-gray-400',    bg: 'bg-gray-800',       border: 'border-gray-700',       label: 'Untested' },
};

const SITE_LABELS = {
  [JOE_FORTUNE.key]: { label: JOE_FORTUNE.label, color: 'text-amber-300' },
  [IGNITION.key]:    { label: IGNITION.label,    color: 'text-red-300' },
};

/**
 * One row of the credential rotation table. Self-contained: handles its own
 * password reveal, rotated-password drafting, validate, and burn toggles.
 * Mutations bubble up via callbacks so the page owns the entity writes.
 */
export default function CasinoCredentialRow({
  credential, onRotate, onValidate, onDelete, onToggleBurn, isValidating,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [draftPassword, setDraftPassword] = useState('');
  const [savingRotation, setSavingRotation] = useState(false);

  const status = STATUS_META[credential.lastValidationStatus || 'unknown'];
  const StatusIcon = status.icon;
  const site = SITE_LABELS[credential.site] || { label: credential.site, color: 'text-gray-300' };

  const handleSaveRotation = async () => {
    if (!draftPassword.trim() || draftPassword === credential.password) return;
    setSavingRotation(true);
    try {
      await onRotate(credential, draftPassword.trim());
      setDraftPassword('');
    } finally {
      setSavingRotation(false);
    }
  };

  const replayUrl = sessionInspectorUrl(credential.lastValidationSessionId);

  return (
    <div className={`bg-gray-900 border ${credential.isBurned ? 'border-red-500/30 opacity-70' : 'border-gray-800'} rounded-xl p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`text-xs font-semibold uppercase tracking-wide ${site.color}`}>{site.label}</span>
          <span className="text-gray-700">·</span>
          <span className="text-sm font-medium text-white truncate">{credential.email}</span>
          {credential.isBurned && (
            <Badge className="bg-red-500/15 text-red-300 border-red-500/30 gap-1 text-xs">
              <Flame className="w-3 h-3" /> Burned
            </Badge>
          )}
        </div>
        <Badge className={`${status.bg} ${status.color} ${status.border} border gap-1 text-xs`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </Badge>
      </div>

      {credential.lastValidationDetails && (
        <div className="text-xs text-gray-500 italic truncate" title={credential.lastValidationDetails}>
          {credential.lastValidationDetails}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Current password</label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={credential.password || ''}
              readOnly
              className="bg-gray-800 border-gray-700 text-gray-300 h-8 text-xs font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1.5 text-gray-500 hover:text-gray-200"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Rotate to new password</label>
          <div className="flex gap-1.5">
            <Input
              type="text"
              placeholder="New password"
              value={draftPassword}
              onChange={(e) => setDraftPassword(e.target.value)}
              className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs font-mono"
            />
            <Button
              size="sm"
              onClick={handleSaveRotation}
              disabled={!draftPassword.trim() || draftPassword === credential.password || savingRotation || credential.isBurned}
              className="h-8 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-black"
              title="Save rotation"
            >
              {savingRotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-gray-800/60">
        <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
          <span>
            Rotated:{' '}
            <span className="text-gray-400">
              {credential.lastRotatedAt ? formatDistanceToNow(new Date(credential.lastRotatedAt), { addSuffix: true }) : 'never'}
            </span>
          </span>
          <span>
            Validated:{' '}
            <span className="text-gray-400">
              {credential.lastValidatedAt ? formatDistanceToNow(new Date(credential.lastValidatedAt), { addSuffix: true }) : 'never'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {replayUrl && (
            <a href={replayUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-8 px-2 border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 text-xs">
                <Film className="w-3 h-3" /> Replay
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isValidating || credential.isBurned}
            onClick={() => onValidate(credential)}
            className="h-8 px-2.5 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 gap-1.5 text-xs"
          >
            {isValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Test login
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleBurn(credential)}
            className={`h-8 px-2 gap-1.5 text-xs ${credential.isBurned ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'}`}
            title={credential.isBurned ? 'Unmark as burned' : 'Mark as burned'}
          >
            <Flame className="w-3 h-3" />
            {credential.isBurned ? 'Unburn' : 'Burn'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(credential)}
            className="h-8 w-8 p-0 text-gray-500 hover:text-red-400"
            title="Delete credential"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}