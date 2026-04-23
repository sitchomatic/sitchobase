import { useState, useMemo } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient, isUsingApiKeyAuth, canUseDirectBrowserbase } from '@/lib/bbClient';
import { sanitizeCredential, warnApiKey, warnProjectId } from '@/lib/credentialSanitize';
import DeleteAccountCard from '@/components/settings/DeleteAccountCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon, Key, CheckCircle, AlertCircle,
  Loader2, Trash2, ExternalLink, Eye, EyeOff
} from 'lucide-react';

export default function Settings() {
  const { credentials, saveCredentials, clearCredentials, isConfigured } = useCredentials();
  const [form, setForm] = useState({ apiKey: credentials.apiKey, projectId: credentials.projectId });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const setField = (field, raw) => {
    setForm((f) => ({ ...f, [field]: sanitizeCredential(raw) }));
    setTestResult(null);
  };

  const apiKeyWarning = useMemo(() => warnApiKey(form.apiKey), [form.apiKey]);
  const projectIdWarning = useMemo(() => warnProjectId(form.projectId), [form.projectId]);
  const isDirty =
    form.apiKey !== credentials.apiKey || form.projectId !== credentials.projectId;

  const save = () => {
    if (!form.apiKey || !form.projectId) {
      toast.error('Both API Key and Project ID are required');
      return;
    }
    const clean = saveCredentials(form);
    setForm(clean); // keep form visibly in sync with what was stored
    toast.success('Credentials saved');
    setTestResult(null);
  };

  const test = async () => {
    if (!form.apiKey || !form.projectId) {
      toast.error('Enter credentials first');
      return;
    }
    // Save first so bbClient picks them up
    const clean = saveCredentials(form);
    setForm(clean);
    setTesting(true);
    setTestResult(null);

    const [sessions, usage] = await Promise.allSettled([
      bbClient.listSessions(),
      bbClient.getProjectUsage(),
    ]);

    if (sessions.status === 'fulfilled') {
      setTestResult({
        success: true,
        sessions: Array.isArray(sessions.value) ? sessions.value.length : 0,
        usage: usage.status === 'fulfilled' ? usage.value : null,
      });
      toast.success('Connection successful!');
    } else {
      setTestResult({
        success: false,
        error: sessions.reason?.message || 'Unknown error',
        isApiKeyLimitation: Boolean(sessions.reason?.isApiKeyBbProxyLimitation),
      });
      toast.error('Connection failed');
    }
    setTesting(false);
  };

  const clear = () => {
    clearCredentials();
    setForm({ apiKey: '', projectId: '' });
    setTestResult(null);
    toast.success('Credentials cleared');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !testing) {
      e.preventDefault();
      save();
    }
  };

  // Compute once per render so both banners agree and we don't re-parse
  // localStorage twice on the same paint.
  const apiKeyAuth = isUsingApiKeyAuth();
  const directEligible = apiKeyAuth && canUseDirectBrowserbase();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gray-400" /> Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your Browserbase credentials</p>
      </div>

      {apiKeyAuth && directEligible && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Local dev: direct Browserbase API</div>
            <div className="text-xs mt-0.5 opacity-80">
              <code className="bg-emerald-500/10 px-1 rounded">VITE_BASE44_API_KEY</code> is set
              and a Browserbase API key is stored — Test Connection and the
              Contexts list bypass the bbProxy function and hit Browserbase
              directly via the Vite dev proxy.
            </div>
          </div>
        </div>
      )}

      {apiKeyAuth && !directEligible && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Local API key auth in use</div>
            <div className="text-xs mt-0.5 opacity-80">
              You're running with <code className="bg-amber-500/10 px-1 rounded">VITE_BASE44_API_KEY</code>
              {' '}but the direct Browserbase API path isn't available yet.
              Save a Browserbase API key <strong>and</strong> Project ID below
              to enable it. Until then, Test Connection and the Contexts list
              go through the bbProxy Base44 function, which only works with an
              interactive Google login.
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <div className="text-sm font-semibold text-white flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" /> API Credentials
          </div>
          {isDirty && (
            <span className="text-[10px] font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-xs mb-1.5 block">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="bb_live_…"
                value={form.apiKey}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setField('apiKey', e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  setField('apiKey', e.clipboardData.getData('text'));
                }}
                onKeyDown={handleKeyDown}
                className="bg-gray-800 border-gray-700 text-gray-200 pr-10 font-mono text-xs"
              />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {apiKeyWarning ? (
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> {apiKeyWarning}
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1">
                Find your API key at{' '}
                <a href="https://www.browserbase.com/settings" target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5">
                  browserbase.com/settings <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            )}
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-1.5 block">Project ID</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={form.projectId}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setField('projectId', e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setField('projectId', e.clipboardData.getData('text'));
              }}
              onKeyDown={handleKeyDown}
              className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs"
            />
            {projectIdWarning && (
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> {projectIdWarning}
              </p>
            )}
          </div>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm ${
            testResult.success
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {testResult.success
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div>
              {testResult.success ? (
                <>
                  <div className="font-semibold">
                    {apiKeyAuth && directEligible
                      ? 'Connected successfully via direct Browserbase API'
                      : 'Connected successfully via backend proxy'}
                  </div>
                  <div className="text-xs mt-0.5 opacity-75">
                    {testResult.sessions} sessions · {testResult.usage?.browserMinutes ?? '—'} browser minutes used
                  </div>
                </>
              ) : testResult.isApiKeyLimitation ? (
                <>
                  <div className="font-semibold">Not available under local API key auth</div>
                  <div className="text-xs mt-0.5 opacity-75">{testResult.error}</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">Connection failed</div>
                  <div className="text-xs mt-0.5 opacity-75">{testResult.error}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={test} disabled={testing || !form.apiKey || !form.projectId} variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button onClick={save} disabled={!isDirty || !form.apiKey || !form.projectId}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2 flex-1 disabled:opacity-50">
            <Key className="w-4 h-4" /> {isDirty ? 'Save Credentials' : 'Saved'}
          </Button>
        </div>
      </div>

      {isConfigured && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="text-sm font-semibold text-white">Danger Zone</div>
          <p className="text-xs text-gray-500">Remove stored credentials from this browser</p>
          <Button variant="outline" onClick={clear}
            className="border-red-800 text-red-400 hover:bg-red-500/10 gap-2">
            <Trash2 className="w-4 h-4" /> Clear Credentials
          </Button>
        </div>
      )}

      <DeleteAccountCard />

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
        <div className="text-sm font-semibold text-white">How It Works</div>
        <p className="text-xs text-gray-500">
          Credentials are stored in your browser's local storage. In production or normal operation,
          all Browserbase API calls are made server-side via our secure backend proxy, completely
          bypassing browser CORS restrictions and keeping your API key private. In local development
          with <code className="bg-gray-800/50 px-1 rounded">VITE_BASE44_API_KEY</code> set and
          Browserbase credentials saved, Test Connection and Contexts list calls bypass the proxy
          and go directly to Browserbase via the Vite dev proxy for faster iteration.
        </p>
      </div>
    </div>
  );
}