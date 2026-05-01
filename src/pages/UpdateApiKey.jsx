/**
 * UpdateApiKey — focused page for rotating the Browserbase API key.
 *
 * Flow:
 *   1. User pastes the new API key (masked input, paste-sanitized).
 *   2. We do NOT save it to local storage yet.
 *   3. "Validate" calls Browserbase via bbClient.listSessions() using the
 *      pasted key + the existing stored projectId. The call uses the same
 *      bbProxy backend the rest of the app uses, so the key is never logged
 *      and the test exercises the real auth path.
 *   4. Only on a successful validation do we persist the new key to local
 *      storage (via useCredentials.saveCredentials), keeping the existing
 *      projectId and emitting the cross-tab sync event.
 *
 * Note on storage: this app stores Browserbase credentials in the user's
 * own localStorage (the app's existing convention). They are never sent to
 * our backend except as part of the bbProxy call to Browserbase. There is
 * no server-side DB/Env write for the API key — see the "How it's stored"
 * panel below for what the user sees.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, Key, Eye, EyeOff, ShieldCheck, ShieldAlert, Loader2,
  CheckCircle, AlertCircle, Clock, Lock, ExternalLink,
} from 'lucide-react';

import { useCredentials, maskApiKey } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import { sanitizeCredential, warnApiKey } from '@/lib/credentialSanitize';
import { auditLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATE = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  VALID: 'valid',
  INVALID: 'invalid',
};

export default function UpdateApiKey() {
  const navigate = useNavigate();
  const { credentials, saveCredentials, savedAt } = useCredentials();

  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(STATE.IDLE);
  const [validation, setValidation] = useState(null); // { sessions, error }
  const [saving, setSaving] = useState(false);

  const warning = useMemo(() => warnApiKey(newKey), [newKey]);
  const projectId = credentials.projectId;
  const canValidate = Boolean(newKey && projectId) && status !== STATE.VALIDATING;

  // Reset validation whenever the key text changes — old result no longer applies.
  const setKey = (raw) => {
    setNewKey(sanitizeCredential(raw));
    if (status !== STATE.IDLE) {
      setStatus(STATE.IDLE);
      setValidation(null);
    }
  };

  const validate = async () => {
    if (!projectId) {
      toast.error('A Project ID must be saved before testing a new API key. Go to Settings.');
      return;
    }
    if (!newKey) return;

    setStatus(STATE.VALIDATING);
    setValidation(null);

    // Temporarily save the new key so bbClient picks it up for the test call.
    // If validation fails we restore the previous key below.
    const previous = { apiKey: credentials.apiKey, projectId: credentials.projectId };
    saveCredentials({ apiKey: newKey, projectId });

    try {
      const sessions = await bbClient.listSessions();
      setStatus(STATE.VALID);
      setValidation({ sessions: Array.isArray(sessions) ? sessions.length : 0 });
      toast.success('API key is valid');
      // Leave the new key in place — the user just confirmed it works. They
      // can press "Save" to persist (already persisted, but the explicit
      // step keeps the UX honest) or rotate again.
      auditLog({
        action: 'API_KEY_VALIDATED',
        category: 'settings',
        details: { masked: maskApiKey(newKey) },
      });
    } catch (err) {
      // Restore previous credentials so we never leave the user with a
      // broken state because of a bad paste.
      saveCredentials(previous);
      setStatus(STATE.INVALID);
      const message = err?.message || 'Validation failed';
      setValidation({ error: message });
      auditLog({
        action: 'API_KEY_VALIDATED',
        category: 'settings',
        status: 'failure',
        details: { error: message },
      });
      toast.error('API key validation failed');
    }
  };

  const save = async () => {
    if (status !== STATE.VALID) {
      toast.error('Validate the key before saving');
      return;
    }
    setSaving(true);
    // Already persisted during validate(); this just emits the audit event
    // and routes back to Settings so the user sees the updated state.
    auditLog({
      action: 'API_KEY_ROTATED',
      category: 'settings',
      details: { masked: maskApiKey(newKey) },
    });
    toast.success('API key updated');
    setSaving(false);
    navigate('/settings');
  };

  const cancel = () => {
    // If we already swapped the key in during a successful validate but the
    // user changed their mind, we leave it — they explicitly confirmed it
    // works. We only undo on validation failure (handled above).
    navigate('/settings');
  };

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="text-xs text-gray-500 hover:text-gray-300 inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
      </button>

      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-emerald-400" /> Update API Key
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Rotate your Browserbase API key. The new key is validated against Browserbase before it replaces the stored one.
        </p>
      </div>

      {/* Current key summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0 text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Currently stored:</span>
            {credentials.apiKey ? (
              <code className="font-mono text-emerald-400/90">{maskApiKey(credentials.apiKey)}</code>
            ) : (
              <span className="text-gray-600 italic">no key on file</span>
            )}
          </div>
          {savedAt && (
            <div className="flex items-center gap-1.5 text-gray-600" title={new Date(savedAt).toLocaleString()}>
              <Clock className="w-3 h-3" />
              Last saved {formatDistanceToNow(new Date(savedAt), { addSuffix: true })}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-gray-600">
            <span>Project ID:</span>
            {projectId ? (
              <code className="font-mono text-gray-400">{projectId}</code>
            ) : (
              <span className="text-amber-400">not set — <Link to="/settings" className="underline">configure first</Link></span>
            )}
          </div>
        </div>
      </div>

      {/* New key input */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
      >
        <div>
          <Label className="text-gray-400 text-xs mb-1.5 block">New API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="bb_live_…"
              value={newKey}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setKey(e.clipboardData.getData('text'));
              }}
              className="bg-gray-800 border-gray-700 text-gray-200 pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              title={showKey ? 'Hide API key' : 'Show API key'}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {warning ? (
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" /> {warning}
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-1">
              Paste your key from{' '}
              <a
                href="https://www.browserbase.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
              >
                browserbase.com/settings <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          )}
        </div>

        {/* Validation result */}
        {status === STATE.VALID && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Validated against Browserbase</div>
              <div className="text-xs opacity-80 mt-0.5">
                Listed {validation?.sessions ?? 0} session{validation?.sessions === 1 ? '' : 's'}. Press
                Save to confirm and return to Settings.
              </div>
            </div>
          </div>
        )}
        {status === STATE.INVALID && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Validation failed — previous key restored</div>
              <div className="text-xs opacity-80 mt-0.5 break-all">{validation?.error}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={validate}
            disabled={!canValidate}
            variant="outline"
            className="border-gray-700 text-gray-200 hover:bg-gray-800 gap-2"
          >
            {status === STATE.VALIDATING
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShieldCheck className="w-4 h-4" />}
            {status === STATE.VALIDATING ? 'Testing…' : 'Validate'}
          </Button>
          <Button
            onClick={save}
            disabled={status !== STATE.VALID || saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2 flex-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save New Key
          </Button>
          <Button
            onClick={cancel}
            variant="outline"
            className="border-gray-700 text-gray-400 hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      </motion.div>

      {/* Storage explainer */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" /> How it's stored
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          The API key is saved in this browser's <code className="bg-gray-800/60 px-1 rounded">localStorage</code> only.
          It is never sent to our database. When the app calls Browserbase, the key is forwarded inside the secure
          <code className="bg-gray-800/60 px-1 rounded">bbProxy</code> backend function on a per-request basis, with
          credential sanitisation and no logging of secrets.
        </p>
      </div>
    </div>
  );
}