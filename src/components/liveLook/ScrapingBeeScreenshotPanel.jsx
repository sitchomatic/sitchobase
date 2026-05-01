/**
 * ScrapingBeeScreenshotPanel — uses the ScrapingBee HTML API
 * `screenshot=true` (or `screenshot_full_page=true`) parameter to
 * capture an on-demand screenshot of any URL.
 *
 * Docs: https://www.scrapingbee.com/documentation/  (screenshot param)
 * Backend: liveLook function with provider='scrapingbee'.
 *
 * The function returns the PNG as a base64 data URL so the API key
 * never leaves the server and the browser can render it directly.
 */
import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ProviderStatusPill from './ProviderStatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Camera, Download, AlertCircle, Loader2, RefreshCw, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_URL = 'https://example.com';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ScrapingBeeScreenshotPanel() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [fullPage, setFullPage] = useState(false);
  const [premiumProxy, setPremiumProxy] = useState(false);
  const [pingStatus, setPingStatus] = useState('idle');
  const [pingError, setPingError] = useState('');
  const [usage, setUsage] = useState(null);
  const [shot, setShot] = useState(null); // { dataUrl, bytes, remainingCalls }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ping = useCallback(async () => {
    setPingStatus('pinging');
    setPingError('');
    const res = await base44.functions.invoke('liveLook', { provider: 'scrapingbee', op: 'ping' });
    if (res.data?.ok) {
      setPingStatus('ok');
      setUsage(res.data.data || null);
    } else {
      setPingStatus('error');
      setPingError(res.data?.error || 'Ping failed');
    }
  }, []);

  const capture = useCallback(async () => {
    if (!url || !/^https?:\/\//.test(url)) {
      toast.error('Enter a valid http(s) URL');
      return;
    }
    setLoading(true);
    setShot(null);
    setError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'scrapingbee',
      op: 'screenshot',
      url,
      fullPage,
      premiumProxy,
    });
    setLoading(false);
    if (res.data?.ok && res.data.data?.dataUrl) {
      setShot(res.data.data);
      toast.success('Screenshot captured');
    } else {
      setError(res.data?.error || 'Screenshot failed');
    }
  }, [url, fullPage, premiumProxy]);

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-gray-900/80 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-500/10 bg-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">ScrapingBee</h2>
            <p className="text-xs text-gray-500">On-demand screenshots of any URL (HTML API)</p>
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
        {usage && (
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 -mt-1">
            <span><span className="text-gray-600">Credits used:</span> <span className="text-amber-300 font-mono">{usage.used_api_credit}</span> / {usage.max_api_credit}</span>
            <span><span className="text-gray-600">Concurrency:</span> <span className="text-amber-300 font-mono">{usage.current_concurrency}</span> / {usage.max_concurrency}</span>
          </div>
        )}

        <div>
          <Label className="text-gray-400 text-xs mb-1.5 block">Target URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
            <span className="text-xs text-gray-300">Full-page screenshot</span>
            <Switch checked={fullPage} onCheckedChange={setFullPage} />
          </label>
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
            <span className="text-xs text-gray-300">Premium proxy (anti-bot)</span>
            <Switch checked={premiumProxy} onCheckedChange={setPremiumProxy} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={capture} disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Capture Screenshot
          </Button>
          {shot?.dataUrl && (
            <a href={shot.dataUrl} download={`scrapingbee-${Date.now()}.png`}>
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Download className="w-4 h-4" /> Download PNG
              </Button>
            </a>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Screenshot failed</div>
              <div className="text-xs opacity-80 mt-0.5 break-all">{error}</div>
            </div>
          </div>
        )}

        {shot?.dataUrl ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3" /> {formatBytes(shot.bytes)}
              </span>
              {shot.remainingCalls != null && (
                <span><span className="text-gray-600">Calls remaining:</span> <span className="text-amber-300 font-mono">{shot.remainingCalls}</span></span>
              )}
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
    </section>
  );
}