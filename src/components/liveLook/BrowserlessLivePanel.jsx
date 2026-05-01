/**
 * BrowserlessLivePanel — uses the Browserless BrowserQL `liveURL` mutation
 * to mint a fully-qualified, embeddable live-streaming URL for ANY public
 * URL the operator supplies. Unlike Browserbase, Browserless can spin up
 * its own browser on-demand for a given URL.
 *
 * Docs: https://docs.browserless.io/bql-schema/operations/mutations/live-url
 * Backend: liveLook function with provider='browserless'.
 */
import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ProviderStatusPill from './ProviderStatusPill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Radio, ExternalLink, Maximize2, AlertCircle, Loader2, Play, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_URL = 'https://example.com';

export default function BrowserlessLivePanel() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [interactable, setInteractable] = useState(true);
  const [showBrowserInterface, setShowBrowserInterface] = useState(false);
  const [pingStatus, setPingStatus] = useState('idle');
  const [pingError, setPingError] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ping = useCallback(async () => {
    setPingStatus('pinging');
    setPingError('');
    const res = await base44.functions.invoke('liveLook', { provider: 'browserless', op: 'ping' });
    if (res.data?.ok) setPingStatus('ok');
    else { setPingStatus('error'); setPingError(res.data?.error || 'Ping failed'); }
  }, []);

  const launch = useCallback(async () => {
    if (!url || !/^https?:\/\//.test(url)) {
      toast.error('Enter a valid http(s) URL');
      return;
    }
    setLoading(true);
    setLiveUrl('');
    setError('');
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserless',
      op: 'live',
      url,
      options: { interactable, showBrowserInterface },
    });
    setLoading(false);
    if (res.data?.ok && res.data.data?.liveURL) {
      setLiveUrl(res.data.data.liveURL);
      toast.success('Live session ready');
    } else {
      setError(res.data?.error || 'Failed to mint live URL');
    }
  }, [url, interactable, showBrowserInterface]);

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gray-900/80 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-cyan-500/10 bg-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Browserless</h2>
            <p className="text-xs text-gray-500">BrowserQL liveURL — interactive on-demand stream</p>
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
        <div>
          <Label className="text-gray-400 text-xs mb-1.5 block">Target URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
            <span className="text-xs text-gray-300">Interactive (mouse/keyboard)</span>
            <Switch checked={interactable} onCheckedChange={setInteractable} />
          </label>
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900">
            <span className="text-xs text-gray-300">Show browser chrome</span>
            <Switch checked={showBrowserInterface} onCheckedChange={setShowBrowserInterface} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={launch} disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Launch Live Stream
          </Button>
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Maximize2 className="w-4 h-4" /> Open in new tab
              </Button>
            </a>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Could not start live stream</div>
              <div className="text-xs opacity-80 mt-0.5 break-all">{error}</div>
            </div>
          </div>
        )}

        {liveUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 inline-flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" /> Live stream (interactive)
              </div>
            </div>
            <iframe
              src={liveUrl}
              title="Browserless live stream"
              className="w-full h-[520px] rounded-lg border border-gray-800 bg-black"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        )}
      </div>
    </section>
  );
}