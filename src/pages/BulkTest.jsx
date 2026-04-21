import { useState, useEffect } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { base44 } from '@/api/base44Client';
import { batchCreateSessions } from '@/lib/browserbaseApi';
import { parseCSV, extractPlaceholders, interpolate } from '@/lib/csvParser';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import ScriptEditor from '@/components/bulk/ScriptEditor';
import CsvUploader from '@/components/bulk/CsvUploader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical, Plus, Pencil, Trash2, ChevronRight, Zap, Loader2,
  CheckCircle, AlertCircle, Globe, Code2, Shield, FileText
} from 'lucide-react';
import { toast } from 'sonner';

export default function BulkTest() {
  const { credentials, isConfigured } = useCredentials();

  // Scripts
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [editingScript, setEditingScript] = useState(null); // null=none, 'new', or script object
  const [scriptsLoading, setScriptsLoading] = useState(true);

  // CSV
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);

  // Job config
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState('au');
  const [useProxy, setUseProxy] = useState(true);
  const [concurrency, setConcurrency] = useState(3);

  // Run state
  const [running, setRunning] = useState(false);
  const [jobResults, setJobResults] = useState([]); // per-row results
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    base44.entities.SavedScript.list('-updated_date', 50)
      .then(s => setScripts(Array.isArray(s) ? s : []))
      .catch(() => setScripts([]))
      .finally(() => setScriptsLoading(false));
  }, []);

  const handleCsvLoad = (text, _filename) => {
    const { headers, rows } = parseCSV(text);
    setCsvHeaders(headers);
    setCsvRows(rows);
  };

  const handleScriptSaved = (saved) => {
    setScripts(prev => {
      const exists = prev.find(s => s.id === saved.id);
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    setSelectedScript(saved);
    setEditingScript(null);
  };

  const deleteScript = async (id) => {
    await base44.entities.SavedScript.delete(id);
    setScripts(prev => prev.filter(s => s.id !== id));
    if (selectedScript?.id === id) setSelectedScript(null);
    toast.success('Script deleted');
  };

  const scriptPlaceholders = selectedScript ? extractPlaceholders(selectedScript.script) : [];
  const missingCols = scriptPlaceholders.filter(p => !csvHeaders.includes(p));
  const canRun = !running && selectedScript && csvRows.length > 0 && missingCols.length === 0;

  const runBulkTest = async () => {
    if (!canRun) return;
    setRunning(true);
    setJobResults([]);
    setRunProgress({ done: 0, total: csvRows.length });

    let successCount = 0;

    // Process rows with concurrency limit
    const queue = [...csvRows.entries()]; // [[index, row], ...]

    const processNext = async () => {
      if (queue.length === 0) return;
      const [rowIdx, row] = queue.shift();

      const interpolatedScript = interpolate(selectedScript.script, row);
      const rowResult = { rowIdx, row, status: 'running', sessionId: null, script: interpolatedScript, error: null };
      setJobResults(prev => [...prev, rowResult]);

      try {
        const session = await batchCreateSessions(
          credentials.apiKey,
          1,
          {
            projectId: credentials.projectId,
            region,
            ...(useProxy ? { proxies: true } : {}),
            userMetadata: {
              bulkTestRow: rowIdx,
              ...(url ? { targetUrl: url } : {}),
              scriptName: selectedScript.name,
              launchedFrom: 'BBCommandCenter-BulkTest',
            },
          }
        );
        const sess = session.results?.[0];
        if (sess) successCount++;
        setJobResults(prev => prev.map(r =>
          r.rowIdx === rowIdx
            ? { ...r, status: sess ? 'completed' : 'error', sessionId: sess?.id ?? null, error: sess ? null : 'Session failed' }
            : r
        ));
      } catch (err) {
        setJobResults(prev => prev.map(r =>
          r.rowIdx === rowIdx ? { ...r, status: 'error', error: err.message } : r
        ));
      }

      setRunProgress(p => ({ ...p, done: p.done + 1 }));
      await processNext();
    };

    // Kick off `concurrency` parallel chains
    const chains = [];
    for (let i = 0; i < Math.min(concurrency, csvRows.length); i++) {
      chains.push(processNext());
    }
    await Promise.all(chains);

    setRunning(false);
    toast.success(`Bulk test complete: ${successCount} sessions launched`);
  };

  if (!isConfigured) return <CredentialsGuard />;

  const pct = runProgress.total > 0 ? Math.round((runProgress.done / runProgress.total) * 100) : 0;
  const doneCount = jobResults.filter(r => r.status === 'completed').length;
  const errorCount = jobResults.filter(r => r.status === 'error').length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-orange-400" /> Bulk Concurrent Test
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a CSV, pick a script with matching <code className="text-emerald-400 bg-gray-800 px-1 rounded text-xs">{'{{placeholders}}'}</code>,
          and launch one session per row — concurrently.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Script library ─────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-400" /> Saved Scripts
              </span>
              <Button size="sm" variant="ghost"
                onClick={() => setEditingScript('new')}
                className="h-7 px-2 text-xs text-purple-400 hover:bg-purple-500/10 gap-1">
                <Plus className="w-3 h-3" /> New
              </Button>
            </div>

            {scriptsLoading && <div className="text-xs text-gray-500 text-center py-4">Loading…</div>}

            {!scriptsLoading && scripts.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-4">
                No scripts yet. Create one to get started.
              </div>
            )}

            <div className="space-y-1.5">
              {scripts.map(s => (
                <div key={s.id}
                  onClick={() => { setSelectedScript(s); setEditingScript(null); }}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    selectedScript?.id === s.id
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <ChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">{s.name}</div>
                    {s.placeholders?.length > 0 && (
                      <div className="text-xs text-gray-600 truncate font-mono">
                        {s.placeholders.map(p => `{{${p}}}`).join(' ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setEditingScript(s); }}
                      className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-200 rounded">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteScript(s.id); }}
                      className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Script editor inline */}
          {editingScript !== null && (
            <ScriptEditor
              script={editingScript === 'new' ? null : editingScript}
              onSave={handleScriptSaved}
              onCancel={() => setEditingScript(null)}
            />
          )}
        </div>

        {/* ── MIDDLE: CSV + config ─────────────────────────── */}
        <div className="space-y-4">
          {/* Selected script info */}
          {selectedScript && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300">{selectedScript.name}</span>
                <button onClick={() => setEditingScript(selectedScript)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {extractPlaceholders(selectedScript.script).map(p => (
                  <Badge key={p} className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {`{{${p}}}`}
                  </Badge>
                ))}
              </div>
              <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">
                {selectedScript.script}
              </pre>
            </div>
          )}

          {/* CSV Upload */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> CSV Data
            </div>
            <CsvUploader
              headers={csvHeaders}
              rows={csvRows}
              requiredColumns={scriptPlaceholders}
              onLoad={handleCsvLoad}
              onClear={() => { setCsvHeaders([]); setCsvRows([]); }}
            />
          </div>

          {/* Target URL (optional override) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <Label className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Target URL
              <span className="text-xs text-gray-600 font-normal">(optional — can also be in CSV)</span>
            </Label>
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="bg-gray-800 border-gray-700 text-gray-200 text-sm"
            />
          </div>
        </div>

        {/* ── RIGHT: Run config + results ──────────────────── */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-white">Run Configuration</div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">
                Concurrency: <span className="text-orange-400 font-bold">{concurrency}</span> simultaneous sessions
              </Label>
              <input
                type="range" min={1} max={10} step={1} value={concurrency}
                onChange={e => setConcurrency(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>1</span><span>10</span></div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {[
                    { value: 'au', label: 'au 🇦🇺 Australia' },
                    { value: 'us-west-2', label: 'us-west-2' },
                    { value: 'us-east-1', label: 'us-east-1' },
                    { value: 'eu-central-1', label: 'eu-central-1' },
                  ].map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-gray-200">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-800">
              <Label className="text-gray-300 text-sm flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> Residential Proxy
              </Label>
              <Switch checked={useProxy} onCheckedChange={setUseProxy} />
            </div>

            {/* Summary */}
            {csvRows.length > 0 && selectedScript && (
              <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                <div className="flex justify-between"><span>Rows to process</span><span className="text-white">{csvRows.length}</span></div>
                <div className="flex justify-between"><span>Script</span><span className="text-purple-300 truncate max-w-[120px]">{selectedScript.name}</span></div>
                <div className="flex justify-between"><span>Concurrency</span><span className="text-orange-400">{concurrency}×</span></div>
                {missingCols.length > 0 && (
                  <div className="text-red-400 pt-1">⚠ Missing: {missingCols.map(c => `{{${c}}}`).join(', ')}</div>
                )}
              </div>
            )}

            <Button
              onClick={runBulkTest}
              disabled={!canRun}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold gap-2 disabled:opacity-40"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {running
                ? `Running… (${runProgress.done}/${runProgress.total})`
                : csvRows.length > 0
                  ? `Run ${csvRows.length} Row${csvRows.length > 1 ? 's' : ''}`
                  : 'Upload CSV to run'}
            </Button>
          </div>

          {/* Progress + results */}
          {(running || jobResults.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Results</span>
                {!running && (
                  <span className="text-xs text-gray-500">
                    {doneCount - errorCount} ok · {errorCount} failed
                  </span>
                )}
              </div>

              {running && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{runProgress.done} / {runProgress.total} rows</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {jobResults.map((r, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                    r.status === 'error' ? 'bg-red-500/10' : r.status === 'running' ? 'bg-gray-800/60' : r.status === 'completed' ? 'bg-emerald-500/5' : 'bg-gray-800/40'
                  }`}>
                    {r.status === 'running' ? (
                      <Loader2 className="w-3 h-3 text-orange-400 animate-spin flex-shrink-0 mt-0.5" />
                    ) : r.status === 'error' ? (
                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500">Row {r.rowIdx + 1}</span>
                        {Object.entries(r.row).map(([k, v]) => (
                          <span key={k} className="text-gray-400">
                            <span className="text-gray-600">{k}=</span>{String(v).slice(0, 20)}
                          </span>
                        ))}
                      </div>
                      {r.sessionId && (
                        <div className="font-mono text-gray-500 truncate">{r.sessionId}</div>
                      )}
                      {r.error && <div className="text-red-400">{r.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}