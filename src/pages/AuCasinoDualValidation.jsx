/**
 * AU Casino — Dual-Target Validation
 *
 * For every row in an uploaded credentials.csv, validates the same
 * username/password against BOTH Joe Fortune and Ignition Casino in
 * parallel under the AU mobile / residential proxy preset.
 *
 * Each (row × target) pair is a separate task with its own session,
 * its own evidence record, and its own pass/review/failed status.
 * Click any target pill to open the Automation Inspector with the
 * step-by-step screenshot timeline + embedded recording.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Upload, Play, StopCircle, AlertTriangle, Shield, Smartphone, Globe, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { parseCSV } from '@/lib/csvParser';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { normalizeBulkRows, MAX_ROWS } from '@/lib/authorizedBulkValidation';
import { auditLog } from '@/lib/auditLog';
import { runAuCasinoDualValidation } from '@/lib/auCasinoDualRunner';
import { AU_CASINO_TARGETS, AU_REGION } from '@/lib/auCasino';
import DualTargetRowItem from '@/components/auCasino/DualTargetRowItem';
import DualValidationSummary from '@/components/auCasino/DualValidationSummary';
import { rowsToCSV, downloadFile } from '@/lib/csvExport';

const MAX_CONCURRENCY = 6;
const CSV_COLS = ['rowIndex', 'username', 'targetKey', 'targetLabel', 'status', 'outcome', 'sessionId', 'finalUrl', 'startedAt', 'endedAt'];

function exportTasksCSV(rows, tasksByKey) {
  const flat = [];
  for (const row of rows) {
    for (const target of AU_CASINO_TARGETS) {
      const task = tasksByKey[`${row.index}:${target.key}`] || {};
      flat.push({
        rowIndex: row.index,
        username: row.username,
        targetKey: target.key,
        targetLabel: target.label,
        status: task.status || 'queued',
        outcome: task.outcome || '',
        sessionId: task.sessionId || '',
        finalUrl: task.finalUrl || '',
        startedAt: task.startedAt || '',
        endedAt: task.endedAt || '',
      });
    }
  }
  downloadFile(`au-casino-dual-validation-${Date.now()}.csv`, rowsToCSV(flat, CSV_COLS), 'text/csv');
}

export default function AuCasinoDualValidation() {
  const { isConfigured } = useCredentials();
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);
  const runIdRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [concurrency, setConcurrency] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  // Map of `${rowIndex}:${targetKey}` → task state.
  const [tasksByKey, setTasksByKey] = useState({});

  const totalTasks = rows.length * AU_CASINO_TARGETS.length;

  const validationErrors = useMemo(() => {
    const errs = [];
    if (!confirmed) errs.push('Confirm you own these accounts or have written permission to test them.');
    if (!rows.length) errs.push('Upload a CSV with username/email and password columns.');
    return errs;
  }, [confirmed, rows]);

  if (!isConfigured) return <CredentialsGuard />;

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    const normalized = normalizeBulkRows(parsed.rows);
    setFileName(file.name);
    setRows(normalized);
    setTasksByKey({});
    toast.success(`Loaded ${normalized.length} row${normalized.length !== 1 ? 's' : ''} → ${normalized.length * 2} dual-target tasks`);
  };

  const start = async () => {
    if (validationErrors.length) {
      toast.error(validationErrors[0]);
      return;
    }
    abortRef.current = false;
    runIdRef.current = `audual-${Date.now()}`;
    setRunning(true);
    setTasksByKey({});

    auditLog({
      action: 'AU_CASINO_DUAL_VALIDATION_STARTED',
      category: 'bulk',
      details: { runId: runIdRef.current, rows: rows.length, totalTasks: rows.length * 2, concurrency },
    });

    try {
      await runAuCasinoDualValidation({
        rows,
        concurrency,
        runId: runIdRef.current,
        shouldAbort: () => abortRef.current,
        onTaskUpdate: (patch) => {
          setTasksByKey((prev) => ({
            ...prev,
            [patch.taskKey]: { ...(prev[patch.taskKey] || {}), ...patch },
          }));
        },
      });
      toast.success(abortRef.current ? 'Run stopped' : 'Dual-target validation complete');
      auditLog({
        action: 'AU_CASINO_DUAL_VALIDATION_COMPLETED',
        category: 'bulk',
        status: abortRef.current ? 'failure' : 'success',
        details: { runId: runIdRef.current },
      });
    } catch (error) {
      toast.error(error?.message || 'Run failed');
      auditLog({
        action: 'AU_CASINO_DUAL_VALIDATION_COMPLETED',
        category: 'bulk',
        status: 'failure',
        details: { runId: runIdRef.current, error: error?.message },
      });
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current = true;
    toast.info('Stopping after in-flight tasks finish');
  };

  const hasResults = Object.keys(tasksByKey).length > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-red-500/5 to-transparent px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-lg font-bold text-white">AU Casino — Dual-Target Validation</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Each row × {AU_CASINO_TARGETS.map((t) => t.label).join(' + ')} runs as a parallel task with AU mobile fingerprint, residential proxy, and per-task screenshot timeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 gap-1 capitalize">
            <Globe className="w-3 h-3" /> {AU_REGION}
          </Badge>
          <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 gap-1">
            <Smartphone className="w-3 h-3" /> AU Mobile
          </Badge>
          <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 gap-1">
            <Shield className="w-3 h-3" /> Residential Proxy
          </Badge>
        </div>
        <Link to="/au-casino">
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">Back to AU Casino</Button>
        </Link>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex gap-3 text-yellow-100">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold">Authorization required</div>
          <div className="text-xs opacity-80 mt-0.5">
            This tool tests credentials you own or have explicit written permission to validate. Misuse violates the casinos' terms of service.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: config */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={running} variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <Upload className="w-4 h-4" /> Upload credentials CSV
            </Button>
            <div className="text-xs text-gray-500">
              Columns: <span className="font-mono text-gray-300">username</span> or <span className="font-mono text-gray-300">email</span>, plus <span className="font-mono text-gray-300">password</span>. Max {MAX_ROWS} rows.
            </div>
            {fileName && (
              <div className="text-xs text-emerald-400 truncate">
                {fileName} · {rows.length} rows × {AU_CASINO_TARGETS.length} targets = <span className="font-bold">{totalTasks} tasks</span>
              </div>
            )}

            <div>
              <Label className="text-xs text-gray-400 mb-2 block">Parallel tasks: <span className="text-emerald-400 font-bold">{concurrency}</span></Label>
              <Slider min={1} max={MAX_CONCURRENCY} step={1} value={[concurrency]} onValueChange={([v]) => setConcurrency(v)} disabled={running} />
              <div className="text-[10px] text-gray-600 mt-1">Higher = faster but more browser-minute spend.</div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmed(!confirmed)}
              disabled={running}
              className={`w-full rounded-lg border p-3 text-left text-xs ${
                confirmed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-gray-800 bg-gray-950 text-gray-400'
              }`}
            >
              I confirm I own or have written permission to test all credentials in this CSV.
            </button>
          </div>

          <div className="flex gap-2">
            {!running ? (
              <Button onClick={start} disabled={validationErrors.length > 0} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2">
                <Play className="w-4 h-4" /> Start dual-target run
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" className="flex-1 gap-2">
                <StopCircle className="w-4 h-4" /> Stop
              </Button>
            )}
            {hasResults && (
              <Button onClick={() => exportTasksCSV(rows, tasksByKey)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                <Download className="w-4 h-4" /> CSV
              </Button>
            )}
          </div>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-2 space-y-4">
          <DualValidationSummary tasksByKey={tasksByKey} totalTasks={totalTasks} />

          {validationErrors.length > 0 && !running && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
              <div className="font-semibold text-gray-200 mb-2">Ready checklist</div>
              <ul className="space-y-1 list-disc list-inside">
                {validationErrors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((row) => {
                const tasks = {};
                for (const target of AU_CASINO_TARGETS) {
                  tasks[target.key] = tasksByKey[`${row.index}:${target.key}`];
                }
                return <DualTargetRowItem key={row.index} row={row} tasks={tasks} />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}