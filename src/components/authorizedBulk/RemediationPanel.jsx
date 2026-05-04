/**
 * Remediation panel for the QA History detail page.
 *
 * Lets the operator pick failed rows from a parent run, paste a CSV with
 * just those usernames + passwords, and kick off a heal-run. Renders a
 * side-by-side compare table of parent vs heal outcomes when complete.
 */
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Activity, AlertTriangle, ArrowRight, ExternalLink, Heart, Play, RefreshCw, Upload } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { autoHealRun, matchHealCandidates } from '@/lib/autoHealRuns';
import { auditLog } from '@/lib/auditLog';
import RemediationCompareTable from '@/components/authorizedBulk/RemediationCompareTable';

const HEALABLE_STATUSES = new Set(['failed', 'review']);

export default function RemediationPanel({ parentRun }) {
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);
  const [selected, setSelected] = useState(() => new Set());
  const [supplied, setSupplied] = useState([]);
  const [suppliedFileName, setSuppliedFileName] = useState('');
  const [healing, setHealing] = useState(false);
  const [healRunId, setHealRunId] = useState(null);
  const [liveResults, setLiveResults] = useState({});

  const failedRows = useMemo(
    () => (parentRun?.results || []).filter((r) => HEALABLE_STATUSES.has(r.status)),
    [parentRun]
  );

  const { data: latestHealRuns = [], refetch: refetchHealRuns } = useQuery({
    queryKey: ['healRuns', parentRun?.id],
    queryFn: () => base44.entities.AuthorizedBulkQARun.filter({ parentRunId: parentRun.id }, '-startedAt', 10),
    enabled: !!parentRun?.id,
    initialData: [],
    refetchInterval: healing ? 3_000 : false,
  });

  const { data: healRun } = useQuery({
    queryKey: ['healRun', healRunId],
    queryFn: () => base44.entities.AuthorizedBulkQARun.get(healRunId),
    enabled: !!healRunId,
    refetchInterval: healing ? 2_500 : false,
  });

  const toggleAll = () => {
    if (selected.size === failedRows.length) setSelected(new Set());
    else setSelected(new Set(failedRows.map((r) => r.username)));
  };

  const toggleOne = (username) => {
    const next = new Set(selected);
    if (next.has(username)) next.delete(username); else next.add(username);
    setSelected(next);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    setSupplied(parsed.rows || []);
    setSuppliedFileName(file.name);
    toast.success(`Loaded ${parsed.rows?.length || 0} credential rows`);
  };

  const selectedUsernames = useMemo(() => Array.from(selected), [selected]);
  const matchInfo = useMemo(
    () => matchHealCandidates(selectedUsernames, supplied),
    [selectedUsernames, supplied]
  );

  const startHeal = async () => {
    if (!matchInfo.matched.length) {
      toast.error('No selected usernames matched the uploaded credentials.');
      return;
    }
    abortRef.current = false;
    setHealing(true);
    setLiveResults({});
    setHealRunId(null);

    auditLog({
      action: 'AUTHORIZED_BULK_HEAL_STARTED',
      category: 'bulk',
      targetId: parentRun.id,
      details: { matched: matchInfo.matched.length, missing: matchInfo.missing.length },
    });

    try {
      const childId = await autoHealRun({
        parentRun,
        matched: matchInfo.matched,
        concurrency: Math.min(2, matchInfo.matched.length),
        shouldAbort: () => abortRef.current,
        onRowUpdate: (patch) => {
          setLiveResults((prev) => ({ ...prev, [patch.username]: { ...(prev[patch.username] || {}), ...patch } }));
          if (!healRunId) return;
        },
      });
      setHealRunId(childId);
      auditLog({
        action: 'AUTHORIZED_BULK_HEAL_COMPLETED',
        category: 'bulk',
        targetId: parentRun.id,
        details: { healRunId: childId },
      });
      toast.success('Heal-run complete');
      refetchHealRuns();
    } catch (error) {
      toast.error(error?.message || 'Heal-run failed');
    } finally {
      setHealing(false);
    }
  };

  if (!parentRun) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <Heart className="w-5 h-5 text-rose-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">Remediation</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Re-run failed rows from this run with the same target + selectors. Compare before vs after side-by-side.
          </p>
        </div>
      </div>

      {failedRows.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          No failed or review rows in this run — nothing to heal.
        </div>
      ) : (
        <>
          {/* Step 1 — pick failed rows */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Step 1 · Select failed rows ({selected.size}/{failedRows.length})
              </div>
              <Button size="sm" variant="ghost" onClick={toggleAll} className="text-emerald-400 hover:text-emerald-300 h-7">
                {selected.size === failedRows.length ? 'Clear' : 'Select all'}
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {failedRows.map((row) => (
                <label
                  key={`${row.index}-${row.username}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/60 cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={selected.has(row.username)}
                    onCheckedChange={() => toggleOne(row.username)}
                    className="border-gray-700"
                  />
                  <span className="font-mono text-gray-200 truncate flex-1">{row.username}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase ${
                    row.status === 'failed' ? 'border-red-500/30 text-red-300 bg-red-500/10' : 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10'
                  }`}>
                    {row.status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2 — paste credentials */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">
              Step 2 · Re-supply credentials for selected usernames
            </div>
            <div className="text-[11px] text-gray-500">
              Run records don't store passwords. Upload a CSV with <span className="font-mono text-gray-300">username</span> + <span className="font-mono text-gray-300">password</span> columns covering the rows you want healed.
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 w-full">
              <Upload className="w-4 h-4" /> {suppliedFileName ? `Replace (${suppliedFileName})` : 'Upload heal CSV'}
            </Button>
            {supplied.length > 0 && (
              <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                <span>Loaded: <span className="text-emerald-400">{supplied.length}</span></span>
                <span>Matched: <span className="text-emerald-400">{matchInfo.matched.length}</span></span>
                {matchInfo.missing.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-3 h-3" /> Missing: {matchInfo.missing.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Step 3 — run */}
          <div className="flex items-center gap-3">
            <Button
              onClick={startHeal}
              disabled={healing || matchInfo.matched.length === 0}
              className="bg-rose-500 hover:bg-rose-400 text-white font-bold gap-2"
            >
              {healing ? <Activity className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
              {healing ? `Healing ${Object.keys(liveResults).length}/${matchInfo.matched.length}` : `Heal ${matchInfo.matched.length} row${matchInfo.matched.length !== 1 ? 's' : ''}`}
            </Button>
            {healing && (
              <Button onClick={() => { abortRef.current = true; toast.info('Stopping heal-run…'); }} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Stop
              </Button>
            )}
          </div>
        </>
      )}

      {/* Side-by-side compare for the most recent heal-run */}
      {healRunId && healRun && (
        <RemediationCompareTable parentRun={parentRun} healRun={healRun} />
      )}

      {/* Earlier heal-runs list */}
      {latestHealRuns.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-gray-500">Previous heal-runs</div>
            <Button size="sm" variant="ghost" onClick={() => refetchHealRuns()} className="h-7 text-gray-400 hover:text-gray-200">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {latestHealRuns.map((hr) => (
              <button
                key={hr.id}
                onClick={() => setHealRunId(hr.id)}
                className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded border ${
                  hr.id === healRunId ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-gray-800 hover:bg-gray-800/60'
                }`}
              >
                <span className="font-mono text-gray-300">{new Date(hr.startedAt).toLocaleString()}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-300">{hr.totalRows} rows</span>
                <span className="text-emerald-400 ml-auto">passed {hr.passedCount || 0}</span>
                <span className="text-yellow-400">review {hr.reviewCount || 0}</span>
                <span className="text-red-400">failed {hr.failedCount || 0}</span>
                <ArrowRight className="w-3 h-3 text-gray-500" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}