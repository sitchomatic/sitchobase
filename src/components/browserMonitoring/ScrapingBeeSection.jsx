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
  Camera, Eye, Film, Loader2, AlertCircle, Download, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * ScrapingBee section: HTML API screenshot only.
 * Docs: https://www.scrapingbee.com/documentation/  (screenshot params)
 * Live + Recording are not provider capabilities → disabled tabs.
 */
const DEFAULT_URL = 'https://example.com';

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ScrapingBeeSection() {
  const status = useProviderStatus('scrapingbee');
  const [url, setUrl] = useState(DEFAULT_URL);
  const [fullPage, setFullPage] = useState(false);
  const [premiumProxy, setPremiumProxy] = useState(false);
  const [shot, setShot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capture = useCallback(async () => {
    if (!/^https?:\/\//.test(url)) return toast.error('Enter a valid http(s) URL');
    setLoading(true); setShot(null); setError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'scrapingbee', op: 'screenshot', url, fullPage, premiumProxy,
    });
    setLoading(false);
    appendFromInvoke(res, { provider: 'scrapingbee', op: 'screenshot' });
    if (res.data?.ok && res.data.data?.dataUrl) {
      setShot(res.data.data);
      toast.success('Screenshot captured');
    } else setError(res.data?.error || 'Screenshot failed');
  }, [url, fullPage, premiumProxy]);

  const usage = status.data;
  const metricStrip = usage ? (
    <>
      <span><span className="text-gray-600">Credits:</span> <span className="text-amber-300 font-mono">{usage.used_api_credit}</span> / {usage.max_api_credit}</span>
      <span><span className="text-gray-600">Concurrency:</span> <span className="text-amber-300 font-mono">{usage.current_concurrency}</span> / {usage.max_concurrency}</span>
    </>
  ) : null;

  const screenshotTab = (
    <div className="space-y-3">
      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Target URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-300">Full-page</span>
          <Switch checked={fullPage} onCheckedChange={setFullPage} />
        </label>
        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-300">Premium proxy</span>
          <Switch checked={premiumProxy} onCheckedChange={setPremiumProxy} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={capture} disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          Capture
        </Button>
        {shot?.dataUrl && (
          <a href={shot.dataUrl} download={`scrapingbee-${Date.now()}.png`}>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <Download className="w-4 h-4" /> Download
            </Button>
          </a>
        )}
      </div>
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs break-all">{error}</div>
        </div>
      )}
      {shot?.dataUrl ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> {formatBytes(shot.bytes)}</span>
            {shot.remainingCalls != null && <span>Calls remaining: <span className="text-amber-300 font-mono">{shot.remainingCalls}</span></span>}
          </div>
          <div className="rounded-lg border border-gray-800 bg-black overflow-hidden max-h-[600px] overflow-y-auto">
            <img src={shot.dataUrl} alt={`Capture from ${url}`} className="w-full block" />
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
      Icon={Camera}
      name="ScrapingBee"
      tagline="On-demand screenshots of any URL (HTML API)"
      accent="amber"
      status={status.status}
      error={status.error}
      lastCheckedAt={status.lastCheckedAt}
      onPing={status.ping}
      metricStrip={metricStrip}
      diagnostics={<ProviderDiagnostics diagnostics={status.diagnostics} />}
      defaultTab="screenshot"
      tabs={[
        { value: 'screenshot', label: 'Screenshot', icon: Camera, content: screenshotTab },
        {
          value: 'live',
          label: 'Live Look-In',
          icon: Eye,
          disabled: true,
          disabledReason: 'ScrapingBee is a stateless HTML API — no live browser stream is exposed.',
        },
        {
          value: 'recording',
          label: 'Recording',
          icon: Film,
          disabled: true,
          disabledReason: 'ScrapingBee does not record sessions — use repeated screenshots if you need a timeline.',
        },
      ]}
    />
  );
}