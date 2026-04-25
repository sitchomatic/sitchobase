import { useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Zap, CheckCircle, AlertCircle, Loader2, Globe, Shield, Clock, Video, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';
import { VIEWPORT_PRESETS } from '@/components/fleet/FleetLaunchPresets';
import FleetMetadataForm from '@/components/fleet/FleetMetadataForm';
import FleetContextPicker from '@/components/fleet/FleetContextPicker';

const REGIONS = [
  { value: 'us-west-2',    label: 'us-west-2 🇺🇸' },
  { value: 'us-east-1',    label: 'us-east-1 🇺🇸' },
  { value: 'eu-central-1', label: 'eu-central-1 🇩🇪' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 🇸🇬' },
];

export default function FleetLauncher() {
  const { isConfigured } = useCredentials();
  const [count, setCount] = useState(3);
  const [region, setRegion] = useState('us-west-2');
  const [keepAlive, setKeepAlive] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const [recording, setRecording] = useState(false);
  const [viewportPreset, setViewportPreset] = useState('desktop_1920');
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [tag, setTag] = useState('');
  const [contextId, setContextId] = useState('');
  const [metadata, setMetadata] = useState({ testRun: '', variant: '', priority: 'normal', task: '' });
  const [launching, setLaunching] = useState(false);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  if (!isConfigured) return <CredentialsGuard />;

  const launch = async () => {
    setLaunching(true);
    setResults([]);
    setErrors([]);
    setProgress({ done: 0, total: count });

    const vp = VIEWPORT_PRESETS.find(v => v.value === viewportPreset) || VIEWPORT_PRESETS[0];
    const userMetadata = {
      launchedFrom: 'BBCommandCenter',
      ...(tag ? { tag } : {}),
      ...(metadata.testRun ? { testRun: metadata.testRun } : {}),
      ...(metadata.variant ? { variant: metadata.variant } : {}),
      ...(metadata.priority ? { priority: metadata.priority } : {}),
      ...(metadata.task ? { task: metadata.task } : {}),
    };
    const options = {
      region,
      keepAlive,
      timeout: sessionTimeout,
      browserSettings: {
        viewport: { width: vp.width, height: vp.height },
        recordSession: recording,
        ...(contextId ? { context: { id: contextId, persist: true } } : {}),
      },
      ...(useProxy ? { proxies: true } : {}),
      userMetadata,
    };

    const queue = Array.from({ length: count }, (_, index) => index);
    const workerCount = Math.min(5, count);

    const launchedSessions = [];
    const launchErrors = [];

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (queue.length) {
        const index = queue.shift();
        try {
          const session = await bbClient.createSession(options);
          launchedSessions.push(session);
          setResults(prev => [...prev, session]);
        } catch (err) {
          const entry = { index, error: err?.message || 'Session launch failed' };
          launchErrors.push(entry);
          setErrors(prev => [...prev, entry]);
        } finally {
          setProgress(prev => ({ ...prev, done: prev.done + 1 }));
        }
      }
    }));

    toast.success(`${launchedSessions.length} session${launchedSessions.length !== 1 ? 's' : ''} launched`);
    auditLog({
      action: 'FLEET_LAUNCHED',
      category: 'fleet',
      details: {
        requested: count,
        launched: launchedSessions.length,
        failed: launchErrors.length,
        region,
        tag: tag || undefined,
        keepAlive,
        useProxy,
        recording,
        viewport: viewportPreset,
        contextId: contextId || undefined,
        metadata: userMetadata,
      },
    });
    setLaunching(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Fleet Launcher</h1>
        <p className="text-sm text-gray-500 mt-0.5">Launch concurrent browser sessions via backend proxy</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <div className="text-sm font-semibold text-white">Launch Configuration</div>

          <div>
            <Label className="text-gray-400 text-xs mb-2 block">
              Session Count: <span className="text-emerald-400 font-bold">{count}</span>
            </Label>
            <Slider min={1} max={50} step={1} value={[count]} onValueChange={([v]) => setCount(v)} className="w-full" />
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1</span><span>50</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {REGIONS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-gray-200">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-2 block flex items-center gap-1.5">
                <Monitor className="w-3 h-3 text-cyan-400" /> Viewport
              </Label>
              <Select value={viewportPreset} onValueChange={setViewportPreset}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {VIEWPORT_PRESETS.map(v => (
                    <SelectItem key={v.value} value={v.value} className="text-gray-200">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2 block">Timeout: <span className="text-white">60s</span></Label>
            <Slider min={60} max={60} step={60} value={[sessionTimeout]} onValueChange={([v]) => setSessionTimeout(v)} className="w-full" />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2 block">Tag / Label</Label>
            <Input placeholder="e.g. scrape-job-01" value={tag} onChange={e => setTag(e.target.value)}
              className="bg-gray-800 border-gray-700 text-gray-200" />
          </div>

          <FleetContextPicker contextId={contextId} setContextId={setContextId} />
          <FleetMetadataForm metadata={metadata} setMetadata={setMetadata} />

          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-sm flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Keep Alive
              </Label>
              <Switch checked={keepAlive} onCheckedChange={setKeepAlive} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-sm flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> Residential Proxy
              </Label>
              <Switch checked={useProxy} onCheckedChange={setUseProxy} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-sm flex items-center gap-2">
                <Video className="w-3.5 h-3.5 text-red-400" /> Record Session
              </Label>
              <Switch checked={recording} onCheckedChange={setRecording} />
            </div>
          </div>

          <Button onClick={launch} disabled={launching}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2">
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {launching ? `Launching… (${progress.done}/${progress.total})` : `Launch ${count} Session${count > 1 ? 's' : ''}`}
          </Button>
        </div>

        {/* Results */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-white">Launch Results</div>

          {launching && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progress</span><span>{pct}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {results.length === 0 && errors.length === 0 && !launching && (
            <div className="text-center py-8 text-gray-600 text-sm">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Launch results will appear here
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-mono text-gray-300 truncate flex-1">{s.id}</span>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {errors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400">{e.error}</span>
              </div>
            ))}
          </div>

          {results.length > 0 && (
            <div className="pt-3 border-t border-gray-800 text-xs text-gray-400">
              ✓ {results.length} sessions launched · {errors.length} failed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}