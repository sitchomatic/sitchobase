import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import useProviderStatus from '@/hooks/useProviderStatus';
import { appendFromInvoke } from '@/lib/monitoringLog';
import ProviderSectionShell from './ProviderSectionShell';
import ProviderDiagnostics from './ProviderDiagnostics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Radio, Play, Loader2, AlertCircle, Maximize2, Camera, Download, Image as ImageIcon, Film,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Browserless section: BrowserQL liveURL + REST screenshot.
 * Docs:
 *   - liveURL:    https://docs.browserless.io/bql-schema/operations/mutations/live-url
 *   - Screenshot: https://docs.browserless.io/HTTP-APIs/screenshot
 *   - Recording:  not exposed via REST — disabled tab.
 */
const DEFAULT_URL = 'https://example.com';

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BrowserlessSection() {
  const status = useProviderStatus('browserless');

  const [url, setUrl] = useState(DEFAULT_URL);
  const [interactable, setInteractable] = useState(true);
  const [showBrowserInterface, setShowBrowserInterface] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState('');

  const [shotUrl, setShotUrl] = useState(DEFAULT_URL);
  const [shotFullPage, setShotFullPage] = useState(false);
  const [shot, setShot] = useState(null);
  const [loadingShot, setLoadingShot] = useState(false);
  const [shotError, setShotError] = useState('');

  const launchLive = useCallback(async () => {
    if (!/^https?:\/\//.test(url)) return toast.error('Enter a valid http(s) URL');
    setLoadingLive(true); setLiveUrl(''); setLiveError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserless', op: 'live', url,
      options: { interactable, showBrowserInterface },
    });
    setLoadingLive(false);
    appendFromInvoke(res, { provider: 'browserless', op: 'live' });
    if (res.data?.ok && res.data.data?.liveURL) {
      setLiveUrl(res.data.data.liveURL);
      toast.success('Live session ready');
    } else setLiveError(res.data?.error || 'Failed to mint live URL');
  }, [url, interactable, showBrowserInterface]);

  const captureShot = useCallback(async () => {
    if (!/^https?:\/\//.test(shotUrl)) return toast.error('Enter a valid http(s) URL');
    setLoadingShot(true); setShot(null); setShotError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserless', op: 'screenshot', url: shotUrl, fullPage: shotFullPage,
    });
    setLoadingShot(false);
    appendFromInvoke(res, { provider: 'browserless', op: 'screenshot' });
    if (res.data?.ok && res.data.data?.dataUrl) {
      setShot(res.data.data);
      toast.success('Screenshot captured');
    } else setShotError(res.data?.error || 'Screenshot failed');
  }, [shotUrl, shotFullPage]);

  const liveTab = (
    <div className="space-y-3">
      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Target URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-300">Interactive</span>
          <Switch checked={interactable} onCheckedChange={setInteractable} />
        </label>
        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-300">Show browser chrome</span>
          <Switch checked={showBrowserInterface} onCheckedChange={setShowBrowserInterface} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={launchLive} disabled={loadingLive}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2">
          {loadingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Launch Live Stream
        </Button>
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <Maximize2 className="w-4 h-4" /> Open in tab
            </Button>
          </a>
        )}
      </div>
      {liveError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs break-all">{liveError}</div>
        </div>
      )}
      {liveUrl && (
        <iframe src={liveUrl} title="Browserless live stream"
          className="w-full h-[520px] rounded-lg border border-gray-800 bg-black"
          allow="clipboard-read; clipboard-write" />
      )}
    </div>
  );

  const screenshotTab = (
    <div className="space-y-3">
      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Target URL</Label>
        <Input value={shotUrl} onChange={(e) => setShotUrl(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
      <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900 max-w-xs">
        <span className="text-xs text-gray-300">Full-page</span>
        <Switch checked={shotFullPage} onCheckedChange={setShotFullPage} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={captureShot} disabled={loadingShot}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2">
          {loadingShot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          Capture
        </Button>
        {shot?.dataUrl && (
          <a href={shot.dataUrl} download={`browserless-${Date.now()}.png`}>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <Download className="w-4 h-4" /> Download
            </Button>
          </a>
        )}
      </div>
      {shotError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs break-all">{shotError}</div>
        </div>
      )}
      {shot?.dataUrl ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 inline-flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3" /> {formatBytes(shot.bytes)}
          </div>
          <div className="rounded-lg border border-gray-800 bg-black overflow-hidden max-h-[600px] overflow-y-auto">
            <img src={shot.dataUrl} alt={`Capture from ${shotUrl}`} className="w-full block" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/40 py-12 flex flex-col items-center justify-center gap-2 text-gray-600">
          <ImageIcon className="w-8 h-8 opacity-30" />
          <span className="text-xs">Capture a screenshot to preview here</span>
        </div>
      )}
    </div>
  );

  return (
    <ProviderSectionShell
      Icon={Radio}
      name="Browserless"
      tagline="On-demand interactive live streams + REST screenshots"
      accent="cyan"
      status={status.status}
      error={status.error}
      lastCheckedAt={status.lastCheckedAt}
      onPing={status.ping}
      diagnostics={<ProviderDiagnostics diagnostics={status.diagnostics} />}
      tabs={[
        { value: 'live', label: 'Live Look-In', icon: Play, content: liveTab },
        { value: 'screenshot', label: 'Screenshot', icon: Camera, content: screenshotTab },
        {
          value: 'recording',
          label: 'Recording',
          icon: Film,
          disabled: true,
          disabledReason: 'Browserless does not expose recordings via REST — capture screenshots inside your BQL flow instead.',
        },
      ]}
    />
  );
}