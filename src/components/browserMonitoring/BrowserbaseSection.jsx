import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCredentials } from '@/lib/useCredentials';
import { useBrowserbaseSessions } from '@/lib/browserbaseData';
import { sessionInspectorUrl } from '@/lib/browserbaseUrls';
import useProviderStatus from '@/hooks/useProviderStatus';
import ProviderSectionShell from './ProviderSectionShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe, Eye, ExternalLink, Maximize2, Loader2, AlertCircle, Film, Camera,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Browserbase section: live debugger iframe + post-session rrweb recording.
 * Docs:
 *   - Live debug:   GET /v1/sessions/:id/debug
 *   - Recording:    GET /v1/sessions/:id/recording
 */
export default function BrowserbaseSection() {
  const { credentials } = useCredentials();
  const apiKeyOverride = credentials.apiKey || undefined;
  const sessionsQuery = useBrowserbaseSessions({ enabled: !!credentials.apiKey, refetchInterval: 15_000 });
  const runningSessions = (sessionsQuery.data || []).filter((s) => s.status === 'RUNNING');
  const allSessions = sessionsQuery.data || [];

  const [sessionId, setSessionId] = useState('');
  const status = useProviderStatus('browserbase', { apiKeyOverride });

  // Live debugger state
  const [debug, setDebug] = useState(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [debugError, setDebugError] = useState('');

  // Recording state
  const [recording, setRecording] = useState(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  useEffect(() => {
    if (!sessionId && runningSessions.length > 0) setSessionId(runningSessions[0].id);
  }, [runningSessions, sessionId]);

  const fetchLive = useCallback(async () => {
    if (!sessionId) return toast.error('Pick a session first');
    setLoadingDebug(true); setDebug(null); setDebugError('');
    const res = await base44.functions.invoke('liveLook', { provider: 'browserbase', op: 'live', sessionId, apiKeyOverride });
    setLoadingDebug(false);
    if (res.data?.ok) setDebug(res.data.data);
    else setDebugError(res.data?.error || 'Failed to fetch debug URLs');
  }, [sessionId, apiKeyOverride]);

  const fetchRecording = useCallback(async () => {
    if (!sessionId) return toast.error('Pick a session first');
    setLoadingRecording(true); setRecording(null); setRecordingError('');
    const res = await base44.functions.invoke('liveLook', { provider: 'browserbase', op: 'recording', sessionId, apiKeyOverride });
    setLoadingRecording(false);
    if (res.data?.ok) setRecording(res.data.data);
    else setRecordingError(res.data?.error || 'Failed to fetch recording');
  }, [sessionId, apiKeyOverride]);

  const sessionPicker = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div className="md:col-span-2">
        <Label className="text-gray-400 text-xs mb-1.5 block">Session</Label>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-xs">
            <SelectValue placeholder={allSessions.length ? 'Pick a session' : 'No sessions'} />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 max-h-72">
            {allSessions.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-gray-200 text-xs font-mono">
                {s.id} · {s.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Or paste session ID</Label>
        <Input value={sessionId} onChange={(e) => setSessionId(e.target.value.trim())}
          placeholder="bb_session_…"
          className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
    </div>
  );

  const liveTab = (
    <div className="space-y-3">
      {sessionPicker}
      <div className="flex flex-wrap gap-2">
        <Button onClick={fetchLive} disabled={!sessionId || loadingDebug}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
          {loadingDebug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Open Live View
        </Button>
        {sessionId && (
          <a href={sessionInspectorUrl(sessionId)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <ExternalLink className="w-4 h-4" /> Inspector
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
            <div className="text-xs opacity-60 mt-1">If the session has ended, switch to the Recording tab for the rrweb replay.</div>
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
          <iframe src={debug.debuggerFullscreenUrl} title="Browserbase live debugger"
            className="w-full h-[520px] rounded-lg border border-gray-800 bg-black"
            allow="clipboard-read; clipboard-write" />
        </div>
      )}
    </div>
  );

  const recordingTab = (
    <div className="space-y-3">
      {sessionPicker}
      <div className="flex flex-wrap gap-2">
        <Button onClick={fetchRecording} disabled={!sessionId || loadingRecording}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
          {loadingRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          Load Recording
        </Button>
        {sessionId && (
          <a href={sessionInspectorUrl(sessionId)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <ExternalLink className="w-4 h-4" /> Open in Inspector (replay)
            </Button>
          </a>
        )}
      </div>
      {recordingError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs break-all">{recordingError}</div>
        </div>
      )}
      {recording && (
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4 text-xs space-y-1.5 font-mono">
          <div><span className="text-gray-500">rrweb events:</span> <span className="text-emerald-300">{recording.eventCount}</span></div>
          {recording.firstTimestamp && <div><span className="text-gray-500">First event:</span> <span className="text-gray-300">{new Date(recording.firstTimestamp).toLocaleString()}</span></div>}
          {recording.lastTimestamp && <div><span className="text-gray-500">Last event:</span> <span className="text-gray-300">{new Date(recording.lastTimestamp).toLocaleString()}</span></div>}
          <div className="text-gray-500 mt-2">Use the Inspector link above to replay the full session visually.</div>
        </div>
      )}
    </div>
  );

  return (
    <ProviderSectionShell
      Icon={Globe}
      name="Browserbase"
      tagline="Live debugger iframe + rrweb session recording"
      accent="emerald"
      status={status.status}
      error={status.error}
      lastCheckedAt={status.lastCheckedAt}
      onPing={status.ping}
      tabs={[
        { value: 'live', label: 'Live Look-In', icon: Eye, content: liveTab },
        { value: 'recording', label: 'Recording', icon: Film, content: recordingTab },
        {
          value: 'screenshot',
          label: 'Screenshot',
          icon: Camera,
          disabled: true,
          disabledReason: 'Browserbase exposes screenshots only via the Inspector replay — use the Recording tab.',
        },
      ]}
    />
  );
}