import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import JoeIgniteCsvPicker from '@/components/joeIgnite/JoeIgniteCsvPicker';
import JoeIgniteRowCard from '@/components/joeIgnite/JoeIgniteRowCard';
import JoeIgniteSummaryBar from '@/components/joeIgnite/JoeIgniteSummaryBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Flame, Play, StopCircle, Download, Loader2 } from 'lucide-react';
import { JOE_IGNITE_CONFIG } from '@/lib/joeIgniteConfig';
import { runJoeIgniteBatch } from '@/lib/joeIgniteRunner';
import { buildJoeIgniteExports, downloadCSV } from '@/lib/joeIgniteExport';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

export default function JoeIgnite() {
  const { isConfigured } = useCredentials();
  const location = useLocation();
  const pickerRef = useRef(null);

  const [loaded, setLoaded] = useState(null);
  const [concurrency, setConcurrency] = useState(JOE_IGNITE_CONFIG.DEFAULT_CONCURRENCY);
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const abortRef = useRef(false);

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

  if (!isConfigured) return <CredentialsGuard />;

  const handleLoaded = ({ fileName, credentials }) => {
    setLoaded({ fileName, credentials });
    setRows(credentials.map((c, i) => ({ index: i, email: c.email, status: 'queued' })));
    setFinished(false);
  };

  const handleClear = () => {
    setLoaded(null);
    setRows([]);
    setFinished(false);
  };

  const start = async () => {
    if (!loaded) return;
    setRunning(true);
    setFinished(false);
    abortRef.current = false;
    const batchId = `joe-ignite-${Date.now()}`;
    auditLog({
      action: 'JOE_IGNITE_STARTED',
      category: 'bulk',
      details: { batchId, count: loaded.credentials.length, concurrency },
    });

    await runJoeIgniteBatch({
      credentials: loaded.credentials,
      concurrency,
      batchId,
      shouldAbort: () => abortRef.current,
      onRowUpdate: (patch) => {
        setRows((prev) => prev.map((r) => (r.email === patch.email ? { ...r, ...patch } : r)));
      },
      onComplete: () => {
        setRunning(false);
        setFinished(true);
        toast.success('Joe Ignite batch complete');
        auditLog({ action: 'JOE_IGNITE_COMPLETED', category: 'bulk', details: { batchId } });
      },
    });
  };

  const stop = () => {
    abortRef.current = true;
    setRunning(false);
    toast.info('Stopping after current in-flight sessions…');
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
            <Label className="text-gray-400 text-xs mb-2 block">
              Concurrent workers: <span className="text-emerald-400 font-bold">{concurrency}</span>
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
                <StopCircle className="w-4 h-4" /> Stop After In-Flight
              </Button>
            )}
            {(finished || rows.some((r) => r.status !== 'queued')) && (
              <Button onClick={exportAll} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Download className="w-4 h-4" /> Export CSVs
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Summary + rows */}
      {rows.length > 0 && (
        <>
          <JoeIgniteSummaryBar rows={rows} />
          <div className="space-y-2">
            {rows.map((r) => <JoeIgniteRowCard key={r.email + r.index} row={r} />)}
          </div>
          {running && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Batch in progress…
            </div>
          )}
        </>
      )}
    </div>
  );
}