import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Upload, Play, StopCircle, Download, AlertTriangle } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import AuthorizedBulkSummary from '@/components/authorizedBulk/AuthorizedBulkSummary';
import AuthorizedBulkRows from '@/components/authorizedBulk/AuthorizedBulkRows';
import { clampConcurrency, normalizeBulkRows, validateAuthorizedBulkConfig, MAX_CONCURRENCY, MAX_ROWS } from '@/lib/authorizedBulkValidation';
import { updateRowByIndex } from '@/lib/authorizedBulkStats';
import { runAuthorizedBulkQA } from '@/lib/authorizedBulkRunner';
import { createAuthorizedBulkRun, updateAuthorizedBulkRun } from '@/lib/authorizedBulkPersistence';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

function toCsv(rows) {
  const headers = ['index', 'username', 'status', 'outcome', 'sessionId', 'finalUrl', 'startedAt', 'endedAt'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

function downloadResults(rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `authorized-bulk-qa-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuthorizedBulkQA() {
  const { isConfigured } = useCredentials();
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);
  const activeRunIdRef = useRef(null);
  const persistTimerRef = useRef(null);
  const persistPromiseRef = useRef(Promise.resolve());
  const [fileName, setFileName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [usernameSelector, setUsernameSelector] = useState('input[name="email"]');
  const [passwordSelector, setPasswordSelector] = useState('input[type="password"]');
  const [submitSelector, setSubmitSelector] = useState('button[type="submit"]');
  const [confirmedAuthorization, setConfirmedAuthorization] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [savedRunId, setSavedRunId] = useState(null);

  useEffect(() => () => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
  }, []);

  const validationErrors = useMemo(() => validateAuthorizedBulkConfig({
    targetUrl,
    usernameSelector,
    passwordSelector,
    submitSelector,
    confirmedAuthorization,
    rows,
  }), [targetUrl, usernameSelector, passwordSelector, submitSelector, confirmedAuthorization, rows]);

  if (!isConfigured) return <CredentialsGuard />;

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    const normalized = normalizeBulkRows(parsed.rows);
    setFileName(file.name);
    setRows(normalized.map((row) => ({ ...row, status: 'queued' })));
    toast.success(`Loaded ${normalized.length} valid row${normalized.length !== 1 ? 's' : ''}`);
  };

  const start = async () => {
    if (validationErrors.length) {
      toast.error(validationErrors[0]);
      return;
    }

    abortRef.current = false;
    setRunning(true);
    const resetRows = rows.map((row) => ({ ...row, status: 'queued', outcome: '', sessionId: '', finalUrl: '', pageTitle: '', startedAt: '', endedAt: '' }));
    setRows(resetRows);

    const savedRun = await createAuthorizedBulkRun({ targetUrl, concurrency: clampConcurrency(concurrency), rows: resetRows });
    activeRunIdRef.current = savedRun.id;
    setSavedRunId(savedRun.id);
    auditLog({ action: 'AUTHORIZED_BULK_QA_STARTED', category: 'bulk', details: { runId: savedRun.id, count: resetRows.length, concurrency, targetHost: new URL(targetUrl).host } });

    let latestRows = resetRows;
    const persistSoon = (nextRows) => {
      latestRows = nextRows;
      if (persistTimerRef.current) return;
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        const runId = activeRunIdRef.current;
        const snapshot = latestRows;
        persistPromiseRef.current = persistPromiseRef.current.then(() => updateAuthorizedBulkRun(runId, snapshot, 'running'));
      }, 1500);
    };

    try {
      await runAuthorizedBulkQA({
        rows: resetRows,
        concurrency: clampConcurrency(concurrency),
        config: { targetUrl, usernameSelector, passwordSelector, submitSelector },
        shouldAbort: () => abortRef.current,
        runId: activeRunIdRef.current,
        onRowUpdate: (patch) => {
          setRows((prev) => {
            const next = updateRowByIndex(prev, patch);
            persistSoon(next);
            return next;
          });
        },
      });

      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      await persistPromiseRef.current;
      const finalStatus = abortRef.current ? 'stopped' : 'completed';
      await updateAuthorizedBulkRun(activeRunIdRef.current, latestRows, finalStatus);
      toast.success(finalStatus === 'stopped' ? 'Authorized bulk QA run stopped and saved' : 'Authorized bulk QA run complete and saved');
    } catch (error) {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      await persistPromiseRef.current;
      await updateAuthorizedBulkRun(activeRunIdRef.current, latestRows, 'failed');
      toast.error(error.message || 'Run failed and was saved');
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current = true;
    toast.info('Stopping after in-flight checks finish');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Authorized Bulk QA Tester</h1>
          <p className="text-xs text-gray-400 mt-0.5">Reliability-first login flow testing for systems you own or are permitted to test.</p>
        </div>
        <Link to="/bulk/runs">
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">History</Button>
        </Link>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex gap-3 text-yellow-100">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold">Authorization required</div>
          <div className="text-xs opacity-80 mt-0.5">This tool is designed for approved QA of your own application. It does not target hard-coded third-party sites.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Target login URL</Label>
              <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://your-app.com/login" className="bg-gray-950 border-gray-800 text-gray-100" disabled={running} />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Username/email selector</Label>
              <Input value={usernameSelector} onChange={(e) => setUsernameSelector(e.target.value)} className="bg-gray-950 border-gray-800 text-gray-100 font-mono text-xs" disabled={running} />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Password selector</Label>
              <Input value={passwordSelector} onChange={(e) => setPasswordSelector(e.target.value)} className="bg-gray-950 border-gray-800 text-gray-100 font-mono text-xs" disabled={running} />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Submit selector</Label>
              <Input value={submitSelector} onChange={(e) => setSubmitSelector(e.target.value)} className="bg-gray-950 border-gray-800 text-gray-100 font-mono text-xs" disabled={running} />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Concurrency: <span className="text-emerald-400 font-bold">{concurrency}</span></Label>
              <Slider min={1} max={MAX_CONCURRENCY} step={1} value={[concurrency]} onValueChange={([v]) => setConcurrency(clampConcurrency(v))} disabled={running} />
            </div>
            <button type="button" onClick={() => setConfirmedAuthorization(!confirmedAuthorization)} disabled={running} className={`w-full rounded-lg border p-3 text-left text-xs ${confirmedAuthorization ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-gray-800 bg-gray-950 text-gray-400'}`}>
              I confirm I own this target or have written permission to test it.
            </button>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={running} variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <Upload className="w-4 h-4" /> Upload CSV
            </Button>
            <div className="text-xs text-gray-500">Expected columns: <span className="font-mono text-gray-300">username</span> or <span className="font-mono text-gray-300">email</span>, and <span className="font-mono text-gray-300">password</span>. Max {MAX_ROWS} rows.</div>
            {fileName && <div className="text-xs text-emerald-400 truncate">{fileName} · {rows.length} valid rows</div>}
            {savedRunId && <div className="text-xs text-gray-500 truncate">Saved run: <span className="font-mono">{savedRunId}</span></div>}
          </div>

          <div className="flex gap-2">
            {!running ? (
              <Button onClick={start} disabled={validationErrors.length > 0} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2">
                <Play className="w-4 h-4" /> Start
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" className="flex-1 gap-2">
                <StopCircle className="w-4 h-4" /> Stop
              </Button>
            )}
            {rows.some((row) => row.status !== 'queued') && (
              <Button onClick={() => downloadResults(rows)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Download className="w-4 h-4" /> CSV
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <AuthorizedBulkSummary rows={rows} />
          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
              <div className="font-semibold text-gray-200 mb-2">Ready checklist</div>
              <ul className="space-y-1 list-disc list-inside">
                {validationErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          <AuthorizedBulkRows rows={rows} />
        </div>
      </div>
    </div>
  );
}