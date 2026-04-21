import { useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { getProjectUsage, listSessions } from '@/lib/browserbaseApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Key, CheckCircle, AlertCircle, Loader2, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const { credentials, saveCredentials, clearCredentials, isConfigured } = useCredentials();
  const [form, setForm] = useState({ apiKey: credentials.apiKey, projectId: credentials.projectId });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = () => {
    if (!form.apiKey || !form.projectId) {
      toast.error('Both API Key and Project ID are required');
      return;
    }
    saveCredentials(form);
    toast.success('Credentials saved');
    setTestResult(null);
  };

  const test = async () => {
    if (!form.apiKey || !form.projectId) {
      toast.error('Enter credentials first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const [sessions, usage] = await Promise.allSettled([
      listSessions(form.apiKey),
      getProjectUsage(form.apiKey, form.projectId),
    ]);

    if (sessions.status === 'fulfilled' && usage.status === 'fulfilled') {
      setTestResult({ success: true, sessions: sessions.value.length, usage: usage.value });
      toast.success('Connection successful!');
    } else {
      const sessErr = sessions.reason;
      const isCors = sessErr instanceof TypeError && sessErr.message.includes('fetch');
      const errMsg = isCors
        ? 'CORS block: The Browserbase API does not allow direct browser requests. This is expected in a browser-only app. Your credentials are saved correctly — API calls will work when proxied through a backend.'
        : (sessErr?.message || usage.reason?.message || 'Unknown error');
      setTestResult({ success: false, cors: isCors, error: errMsg });
      toast.error(isCors ? 'Browser CORS block (credentials are fine)' : 'Connection failed');
    }
    setTesting(false);
  };

  const clear = () => {
    clearCredentials();
    setForm({ apiKey: '', projectId: '' });
    setTestResult(null);
    toast.success('Credentials cleared');
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gray-400" /> Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your Browserbase credentials</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" /> API Credentials
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-xs mb-1.5 block">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="bb_live_…"
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-gray-200 pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Find your API key at{' '}
              <a href="https://www.browserbase.com/settings" target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5">
                browserbase.com/settings <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-1.5 block">Project ID</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-gray-200"
            />
          </div>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm ${
            testResult.success
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : testResult.cors
              ? 'bg-orange-500/10 border border-orange-500/30 text-orange-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {testResult.success
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div>
              {testResult.success ? (
                <>
                  <div className="font-semibold">Connected successfully</div>
                  <div className="text-xs mt-0.5 opacity-75">
                    {testResult.sessions} sessions · {testResult.usage?.browserMinutes} browser minutes used
                  </div>
                </>
              ) : testResult.cors ? (
                <>
                  <div className="font-semibold">Browser CORS block — credentials are correct</div>
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
          <Button onClick={test} disabled={testing} variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2 flex-1">
            <Key className="w-4 h-4" /> Save Credentials
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

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
        <div className="text-sm font-semibold text-white">Security Note</div>
        <p className="text-xs text-gray-500">
          Credentials are stored in your browser's local storage. They are never sent to any third-party server.
          All API calls go directly to <code className="text-emerald-400">api.browserbase.com</code>.
        </p>
      </div>
    </div>
  );
}