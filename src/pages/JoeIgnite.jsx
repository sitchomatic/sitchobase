import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import JoeIgniteCsvPicker from '@/components/joeIgnite/JoeIgniteCsvPicker';
import JoeIgniteRowCard from '@/components/joeIgnite/JoeIgniteRowCard';
import JoeIgniteLiveCounters from '@/components/joeIgnite/JoeIgniteLiveCounters';
import JoeIgniteActivityLog from '@/components/joeIgnite/JoeIgniteActivityLog';
import JoeIgniteModeToggle from '@/components/joeIgnite/JoeIgniteModeToggle';
import JoeIgniteProxySourceToggle from '@/components/joeIgnite/JoeIgniteProxySourceToggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Flame, Play, StopCircle, Download, Loader2 } from 'lucide-react';
import { JOE_IGNITE_CONFIG } from '@/lib/joeIgniteConfig';
import { runJoeIgniteBatch } from '@/lib/joeIgniteRunner';
import { buildJoeIgniteExports, downloadCSV } from '@/lib/joeIgniteExport';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function JoeIgnite() {
  const { isConfigured, credentials: bbCreds } = useCredentials();
  const location = useLocation();
  const pickerRef = useRef(null);

  const [loaded, setLoaded] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem('joe_ignite_mode') || 'browser');
  const [proxySource, setProxySource] = useState(() => localStorage.getItem('joe_ignite_proxy_source') || 'bb-au');
  const [concurrency, setConcurrency] = useState(JOE_IGNITE_CONFIG.DEFAULT_CONCURRENCY);
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null);

  const pushEvent = (evt) => setEvents((prev) => [...prev.slice(-499), { at: Date.now(), ...evt }]);
  const abortRef = useRef(false);
  const pollTimerRef = useRef(null);

  useEffect(() => { localStorage.setItem('joe_ignite_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('joe_ignite_proxy_source', proxySource); }, [proxySource]);

  const { data: proxyPool = [] } = useQuery({
    queryKey: ['proxyPool'],
    queryFn: () => base44.entities.ProxyPool.list('-created_date', 500),
    initialData: [],
  });
  const enabledProxies = proxyPool.filter((p) => p.enabled !== false);

  // Autofocus CSV picker when navigated with ?pick=1 (from the Command Center button)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pick') === '1' && !loaded) {
      setTimeout(() => {
        const input = document.querySelector('input[type="file"][accept*="csv"]');
        input?.click();
      }, 200);
    }
  }, [location.search, loaded]);

  // Cleanup poll timer on unmount
  useEffect(() => () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }, []);

  if (!isConfigured) return <CredentialsGuard />;

  const handleLoaded = ({ fileName, credentials }) => {
    setLoaded({ fileName, credentials });
    setRows(credentials.map((c, i) => ({ index: i, email: c.email, status: 'queued' })));
    setEvents([]);
    setFinished(false);
  };

  const handleClear = () => {
    setLoaded(null);
    setRows([]);
    setEvents([]);
    setFinished(false);
    setActiveBatchId(null);
  };

  const startBrowserMode = async (batchId) => {
    abortRef.current = false;
    await runJoeIgniteBatch({
      credentials: loaded.credentials,
      concurrency,
      batchId,
      proxySource,
      shouldAbort: () => abortRef.current,
      onRowUpdate: (patch) => {
        setRows((prev) => prev.map((r) => (r.email === patch.email ? { ...r, ...patch } : r)));
        // Stream events into the activity log
        if (patch.status === 'running' && !patch.phase) {
          pushEvent({ type: 'started', email: patch.email });
        } else if (patch.joeOutcome || patch.ignitionOutcome) {
          const detail = [
            patch.joeOutcome ? `joe:${patch.joeOutcome}` : null,
            patch.ignitionOutcome ? `ign:${patch.ignitionOutcome}` : null,
            patch.attempts ? `try ${patch.attempts}` : null,
          ].filter(Boolean).join(' · ');
          pushEvent({ type: 'attempt', email: patch.email, detail });
        }
        if (patch.phase === 'done' && patch.status) {
          pushEvent({ type: patch.status, email: patch.email, detail: patch.proxyLabel ? `via ${patch.proxyLabel}` : undefined });
        }
      },
      onComplete: () => {
        setRunning(false);
        setFinished(true);
        toast.success('Joe Ignite batch complete');
        auditLog({ action: 'JOE_IGNITE_COMPLETED', category: 'bulk', details: { batchId, mode: 'browser' } });
      },
    });
  };

  const startServerlessMode = async (batchId) => {
    const res = await base44.functions.invoke('joeIgniteBatch', {
      credentials: loaded.credentials,
      concurrency,
      batchId,
      projectId: bbCreds?.projectId,
      proxySource,
    });
    if (res.data?.error) {
      toast.error(`Serverless start failed: ${res.data.error}`);
      setRunning(false);
      return;
    }
    toast.success('Serverless batch dispatched');

    // Poll the entity every 4s to update the UI.
    const seen = new Set();
    const poll = async () => {
      const records = await base44.entities.JoeIgniteRun.filter({ batchId });
      if (records.length > 0) {
        setRows((prev) => prev.map((r) => {
          const rec = records.find((x) => x.email === r.email);
          return rec ? { ...r, ...rec } : r;
        }));
        // Emit an event once per completed credential
        records.forEach((rec) => {
          const terminal = ['success', 'temp_lock', 'perm_ban', 'no_account', 'error'].includes(rec.status);
          if (terminal && !seen.has(rec.email)) {
            seen.add(rec.email);
            const detail = [
              rec.joeOutcome ? `joe:${rec.joeOutcome}` : null,
              rec.ignitionOutcome ? `ign:${rec.ignitionOutcome}` : null,
              rec.attempts ? `try ${rec.attempts}` : null,
            ].filter(Boolean).join(' · ');
            pushEvent({ type: rec.status, email: rec.email, detail });
          }
        });
        const pending = records.filter((r) => r.status === 'queued' || r.status === 'running').length;
        if (pending === 0 && records.length >= loaded.credentials.length) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRunning(false);
          setFinished(true);
          toast.success('Serverless batch complete');
          auditLog({ action: 'JOE_IGNITE_COMPLETED', category: 'bulk', details: { batchId, mode: 'serverless' } });
        }
      }
    };
    await poll();
    pollTimerRef.current = setInterval(poll, 4000);
  };

  const start = async () => {
    if (!loaded) return;
    setRunning(true);
    setFinished(false);
    const batchId = `joe-ignite-${Date.now()}`;
    setActiveBatchId(batchId);
    auditLog({
      action: 'JOE_IGNITE_STARTED',
      category: 'bulk',
      details: { batchId, mode, count: loaded.credentials.length, concurrency },
    });

    if (mode === 'serverless') await startServerlessMode(batchId);
    else await startBrowserMode(batchId);
  };

  const stop = () => {
    if (mode === 'browser') {
      abortRef.current = true;
      setRunning(false);
      toast.info('Stopping after current in-flight sessions…');
    } else {
      // Serverless: we can stop polling but backend keeps running until natural finish
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      setRunning(false);
      toast.info('Stopped polling. Serverless batch continues in the background.');
    }
  };

  const exportAll = () => {
    const files = buildJoeIgniteExports(rows);
    Object.entries(files).forEach(([name, text]) => {
      if (text.split('\n').length > 1) downloadCSV(name, text);
    });
    toast.success('Exports downloaded');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-transparent px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Joe Ignite Testing</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            1 session · 2 tabs · joe + ignition · {JOE_IGNITE_CONFIG.MAX_ATTEMPTS} attempts per credential
          </p>
        </div>
      </div>

      {/* CSV */}
      <div ref={pickerRef}>
        <JoeIgniteCsvPicker loaded={loaded} onLoaded={handleLoaded} onClear={handleClear} />
      </div>

      {/* Controls */}
      {loaded && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <div>
            <Label className="text-gray-400 text-xs mb-2 block">Run mode</Label>
            <JoeIgniteModeToggle mode={mode} onChange={setMode} disabled={running} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-400 text-xs">Proxy source</Label>
              <Link to="/proxies" className="text-[10px] text-gray-500 hover:text-emerald-400">
                Manage pool →
              </Link>
            </div>
            <JoeIgniteProxySourceToggle
              value={proxySource}
              onChange={setProxySource}
              disabled={running}
              poolCount={enabledProxies.length}
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2 block">
              Concurrent workers: <span className="text-emerald-400 font-bold">{concurrency}</span>
              {mode === 'serverless' && concurrency > 8 && (
                <span className="ml-2 text-[10px] text-yellow-400">(serverless capped at 8)</span>
              )}
            </Label>
            <Slider min={1} max={12} step={1} value={[concurrency]}
              onValueChange={([v]) => setConcurrency(v)} disabled={running} />
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1</span><span>12</span></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!running ? (
              <Button onClick={start} className="bg-orange-500 hover:bg-orange-600 text-black font-bold gap-2 flex-1 min-w-[180px]">
                <Play className="w-4 h-4" /> Start Batch ({loaded.credentials.length})
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" className="gap-2 flex-1 min-w-[180px]">
                <StopCircle className="w-4 h-4" /> {mode === 'browser' ? 'Stop After In-Flight' : 'Stop Polling'}
              </Button>
            )}
            {(finished || rows.some((r) => r.status !== 'queued')) && (
              <Button onClick={exportAll} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Download className="w-4 h-4" /> Export CSVs
              </Button>
            )}
          </div>

          {mode === 'serverless' && (
            <div className="text-[11px] text-gray-500 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
              ⚡ Serverless mode: batch runs on the backend and writes results to the database.
              Safe to close this tab — results will be here when you come back.
              Batches should be modest (~25 creds or fewer) due to backend timeouts.
            </div>
          )}
        </div>
      )}

      {/* Summary + rows */}
      {rows.length > 0 && (
        <>
          <JoeIgniteLiveCounters rows={rows} />
          <JoeIgniteActivityLog events={events} />
          <div className="space-y-2">
            {rows.map((r) => <JoeIgniteRowCard key={r.email + r.index} row={r} />)}
          </div>
          {running && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'serverless' ? `Polling batch ${activeBatchId}…` : 'Batch in progress…'}
            </div>
          )}
        </>
      )}
    </div>
  );
}