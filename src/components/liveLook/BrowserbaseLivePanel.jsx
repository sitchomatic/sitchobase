/**
 * BrowserbaseLivePanel — fetches Browserbase's debug URLs for any
 * RUNNING session and embeds the live debugger iframe.
 *
 * Backend: liveLook function with provider='browserbase'.
 * Browserbase docs: GET /v1/sessions/{id}/debug
 *   → { debuggerFullscreenUrl, debuggerUrl, pages[], wsUrl }
 *
 * Live view only works while the session status is RUNNING. Once the
 * session ends Browserbase returns a 404 — we surface that error to the
 * user with a hint to open the post-session Inspector instead.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCredentials } from '@/lib/useCredentials';
import { useBrowserbaseSessions } from '@/lib/browserbaseData';
import { sessionInspectorUrl } from '@/lib/browserbaseUrls';
import ProviderStatusPill from './ProviderStatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe, ExternalLink, Eye, RefreshCw, Maximize2, AlertCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function BrowserbaseLivePanel() {
  const { credentials } = useCredentials();
  const sessionsQuery = useBrowserbaseSessions({ enabled: !!credentials.apiKey, refetchInterval: 15_000 });
  const runningSessions = (sessionsQuery.data || []).filter((s) => s.status === 'RUNNING');

  const [sessionId, setSessionId] = useState('');
  const [pingStatus, setPingStatus] = useState('idle');
  const [pingError, setPingError] = useState('');
  const [debug, setDebug] = useState(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [debugError, setDebugError] = useState('');

  // Auto-select the first running session whenever the list changes.
  useEffect(() => {
    if (!sessionId && runningSessions.length > 0) setSessionId(runningSessions[0].id);
  }, [runningSessions, sessionId]);

  const ping = useCallback(async () => {
    setPingStatus('pinging');
    setPingError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserbase',
      op: 'ping',
      apiKeyOverride: credentials.apiKey || undefined,
    });
    if (res.data?.ok) setPingStatus('ok');
    else { setPingStatus('error'); setPingError(res.data?.error || 'Ping failed'); }
  }, [credentials.apiKey]);

  const fetchLive = useCallback(async () => {
    if (!sessionId) {
      toast.error('Pick a session first');
      return;
    }
    setLoadingDebug(true);
    setDebug(null);
    setDebugError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserbase',
      op: 'live',
      sessionId,
      apiKeyOverride: credentials.apiKey || undefined,
    });
    setLoadingDebug(false);
    if (res.data?.ok) setDebug(res.data.data);
    else setDebugError(res.data?.error || 'Failed to fetch debug URLs');
  }, [sessionId, credentials.apiKey]);

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gray-900/80 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-emerald-500/10 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Globe className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Browserbase</h2>
            <p className="text-xs text-gray-500">Live debugger iframe + post-session inspector</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProviderStatusPill status={pingStatus} error={pingError} />
          <Button size="sm" variant="outline" onClick={ping}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'pinging' ? 'animate-spin' : ''}`} />
            Test
          </Button>
        </div>
      </header>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-gray-400 text-xs mb-1.5 block">Running session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-xs">
                <SelectValue placeholder={runningSessions.length ? 'Pick a session' : 'No running sessions'} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 max-h-72">
                {runningSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-gray-200 text-xs font-mono">
                    {s.id} · {s.region}
                  </SelectItem>
                ))}
                {runningSessions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500">No running sessions. Paste an ID below.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1.5 block">Or session ID</Label>
            <Input value={sessionId} onChange={(e) => setSessionId(e.target.value.trim())}
              placeholder="bb_session_…"
              className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={fetchLive} disabled={!sessionId || loadingDebug}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
            {loadingDebug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Open Live View
          </Button>
          {sessionId && (
            <a href={sessionInspectorUrl(sessionId)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <ExternalLink className="w-4 h-4" /> Inspector (Replay)
              </Button>
            </a>
          )}
        </div>

        {debugError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Could not load live view</div>
              <div className="text-xs opacity-80 mt-0.5 break-all">{debugError}</div>
              <div className="text-xs opacity-60 mt-1">If the session has ended, use the Inspector link above for the rrweb replay.</div>
            </div>
          </div>
        )}

        {debug?.debuggerFullscreenUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">Live debugger ({debug.pages?.length || 0} page{debug.pages?.length === 1 ? '' : 's'})</div>
              <a href={debug.debuggerFullscreenUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                <Maximize2 className="w-3 h-3" /> Fullscreen
              </a>
            </div>
            <iframe
              src={debug.debuggerFullscreenUrl}
              title="Browserbase live debugger"
              className="w-full h-[520px] rounded-lg border border-gray-800 bg-black"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        )}
      </div>
    </section>
  );
}