import { useState, useEffect, useMemo } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { base44 } from '@/api/base44Client';
import { bbClient } from '@/lib/bbClient';
import { parseCSV, extractPlaceholders, interpolate } from '@/lib/csvParser';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import ScriptEditor from '@/components/bulk/ScriptEditor';
import TestSuiteEditor from '@/components/bulk/TestSuiteEditor';
import CsvUploader from '@/components/bulk/CsvUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical, Plus, Pencil, Trash2, ChevronRight, Zap, Loader2,
  CheckCircle, AlertCircle, Globe, Code2, Shield, FileText, Layers, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

const REGIONS = [
  { value: 'us-west-2',    label: 'us-west-2' },
  { value: 'us-east-1',    label: 'us-east-1' },
  { value: 'eu-central-1', label: 'eu-central-1' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1' },
];

export default function BulkTest() {
  const { isConfigured } = useCredentials();
  const [scripts, setScripts] = useState([]);
  const [suites, setSuites] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [editingScript, setEditingScript] = useState(null);
  const [editingSuite, setEditingSuite] = useState(null);
  const [scriptsLoading, setScriptsLoading] = useState(true);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState('us-west-2');
  const [useProxy, setUseProxy] = useState(true);
  const [concurrency, setConcurrency] = useState(3);
  const [running, setRunning] = useState(false);
  const [jobResults, setJobResults] = useState([]);
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    Promise.all([
      base44.entities.SavedScript.list('-updated_date', 50),
      base44.entities.TestSuite.list('-updated_date', 50),
    ])
      .then(([savedScripts, savedSuites]) => {
        setScripts(Array.isArray(savedScripts) ? savedScripts : []);
        setSuites(Array.isArray(savedSuites) ? savedSuites : []);
      })
      .catch(() => {
        setScripts([]);
        setSuites([]);
      })
      .finally(() => setScriptsLoading(false));
  }, []);

  const handleCsvLoad = (text) => {
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

  const handleSuiteSaved = (saved) => {
    setSuites(prev => {
      const exists = prev.find(s => s.id === saved.id);
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    setSelectedSuite(saved);
    setEditingSuite(null);
  };

  const deleteScript = async (id) => {
    await base44.entities.SavedScript.delete(id);
    setScripts(prev => prev.filter(s => s.id !== id));
    if (selectedScript?.id === id) setSelectedScript(null);
    toast.success('Script deleted');
  };

  const suiteScripts = useMemo(() => {
    if (!selectedSuite) return [];
    return (selectedSuite.scriptIds || []).map(id => scripts.find(script => script.id === id)).filter(Boolean);
  }, [selectedSuite, scripts]);

  const scriptPlaceholders = selectedScript ? extractPlaceholders(selectedScript.body) : [];
  const suitePlaceholders = [...new Set(suiteScripts.flatMap(script => extractPlaceholders(script.body)))];
  const activePlaceholders = selectedSuite ? suitePlaceholders : scriptPlaceholders;
  const missingCols = activePlaceholders.filter(p => !csvHeaders.includes(p));
  const canRun = !running && (selectedSuite || selectedScript) && csvRows.length > 0 && missingCols.length === 0 && isConfigured;

  const runBulkTest = async () => {
    if (!canRun) return;
    setRunning(true);
    setJobResults([]);
    setRunProgress({ done: 0, total: csvRows.length });

    const queue = [...csvRows.entries()];

    const processNext = async () => {
      if (queue.length === 0) return;
      const [rowIdx, row] = queue.shift();

      const scenarioSequence = selectedSuite
        ? suiteScripts.map(script => ({ name: script.name, script: interpolate(script.body, row) }))
        : [{ name: selectedScript.name, script: interpolate(selectedScript.body, row) }];
      setJobResults(prev => [...prev, { rowIdx, row, status: 'running', sessionId: null, error: null, script: scenarioSequence[0]?.script, scenarios: scenarioSequence }]);

      const options = {
        region,
        ...(useProxy ? { proxies: true } : {}),
        userMetadata: {
          bulkTestRow: rowIdx,
          ...(url ? { targetUrl: url } : {}),
          scriptName: selectedSuite ? selectedSuite.name : selectedScript.name,
          launchedFrom: 'BBCommandCenter-BulkTest',
          scenarioCount: selectedSuite ? suiteScripts.length : 1,
        },
      };

      let sess = null;
      let errorMessage = null;
      try {
        const result = await bbClient.batchCreateSessions(1, options);
        sess = result?.results?.[0] ?? null;
        if (!sess) errorMessage = result?.errors?.[0]?.error || 'Session failed';
      } catch (err) {
        errorMessage = err?.message || 'Session request failed';
      }

      setJobResults(prev => prev.map(r =>
        r.rowIdx === rowIdx
          ? { ...r, status: sess ? 'completed' : 'error', sessionId: sess?.id ?? null, error: sess ? null : errorMessage }
          : r
      ));
      setRunProgress(p => ({ ...p, done: p.done + 1 }));
      await processNext();
    };

    const chains = [];
    for (let i = 0; i < Math.min(concurrency, csvRows.length); i++) {
      chains.push(processNext());
    }
    await Promise.all(chains);

    // Count from the final accumulated results (not stale state)
    setJobResults(prev => {
      const successCount = prev.filter(r => r.status === 'completed').length;
      const failCount = prev.filter(r => r.status === 'error').length;
      const successRate = prev.length ? Math.round((successCount / prev.length) * 100) : 0;
      auditLog({ action: 'BULK_TEST_RUN', category: 'bulk', details: { script: selectedSuite ? selectedSuite.name : selectedScript.name, rows: csvRows.length, success: successCount, failed: failCount, region } });
      base44.entities.TestRun.create({
        suiteId: selectedSuite?.id || selectedScript.id,
        suiteName: selectedSuite ? selectedSuite.name : selectedScript.name,
        status: 'completed',
        totalSessions: prev.length,
        passedSessions: successCount,
        failedSessions: failCount,
        successRate,
        results: prev,
      });
      return prev;
    });
    setRunning(false);
    toast.success(`Bulk test complete`);
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
          Build reusable scenario sequences, run them across batch-launched browser sessions, and review aggregated success rates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script library */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-400" /> Saved Scripts
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditingScript('new')}
                className="h-7 px-2 text-xs text-purple-400 hover:bg-purple-500/10 gap-1">
                <Plus className="w-3 h-3" /> New
              </Button>
            </div>

            {scriptsLoading && <div className="text-xs text-gray-500 text-center py-4">Loading…</div>}
            {!scriptsLoading && scripts.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-4">No scripts yet. Create one to get started.</div>
            )}

            <div className="space-y-1.5">
              {scripts.map(s => (
                <div key={s.id} onClick={() => { setSelectedScript(s); setEditingScript(null); }}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    selectedScript?.id === s.id
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}>
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

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" /> Test Suites
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditingSuite('new')}
                className="h-7 px-2 text-xs text-cyan-400 hover:bg-cyan-500/10 gap-1">
                <Plus className="w-3 h-3" /> New
              </Button>
            </div>

            <div className="space-y-1.5">
              {suites.map(suite => (
                <div key={suite.id} onClick={() => setSelectedSuite(suite)}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    selectedSuite?.id === suite.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-gray-800 border border-transparent'
                  }`}>
                  <ChevronRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">{suite.name}</div>
                    <div className="text-xs text-gray-600 truncate">{suite.scriptIds?.length || 0} scenarios</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editingScript !== null && (
            <ScriptEditor
              script={editingScript === 'new' ? null : editingScript}
              onSave={handleScriptSaved}
              onCancel={() => setEditingScript(null)}
            />
          )}

          {editingSuite !== null && (
            <TestSuiteEditor
              suite={editingSuite === 'new' ? null : editingSuite}
              scripts={scripts}
              onSave={handleSuiteSaved}
              onCancel={() => setEditingSuite(null)}
            />
          )}
        </div>

        {/* CSV + config */}
        <div className="space-y-4">
          {selectedScript && !selectedSuite && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300">{selectedScript.name}</span>
                <button onClick={() => setEditingScript(selectedScript)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {extractPlaceholders(selectedScript.body).map(p => (
                  <Badge key={p} className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {`{{${p}}}`}
                  </Badge>
                ))}
              </div>
              <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">
                {selectedScript.body}
              </pre>
            </div>
          )}

          {selectedSuite && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-300">{selectedSuite.name}</span>
                <button onClick={() => setEditingSuite(selectedSuite)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="space-y-1.5">
                {suiteScripts.map((script, index) => (
                  <div key={script.id} className="text-xs text-gray-300 bg-gray-800/60 rounded-lg px-3 py-2">
                    <span className="text-cyan-400 mr-2">{index + 1}.</span>{script.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> CSV Data
            </div>
            <CsvUploader
              headers={csvHeaders}
              rows={csvRows}
              requiredColumns={activePlaceholders}
              onLoad={handleCsvLoad}
              onClear={() => { setCsvHeaders([]); setCsvRows([]); }}
            />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <Label className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Target URL
              <span className="text-xs text-gray-600 font-normal">(optional)</span>
            </Label>
            <Input placeholder="https://example.com" value={url}
              onChange={e => setUrl(e.target.value)}
              className="bg-gray-800 border-gray-700 text-gray-200 text-sm" />
          </div>
        </div>

        {/* Run config + results */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-white">Run Configuration</div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">
                Concurrency: <span className="text-orange-400 font-bold">{concurrency}</span> simultaneous sessions
              </Label>
              <input type="range" min={1} max={10} step={1} value={concurrency}
                onChange={e => setConcurrency(Number(e.target.value))}
                className="w-full accent-orange-400" />
              <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>1</span><span>10</span></div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {REGIONS.map(r => (
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

            {csvRows.length > 0 && selectedScript && (
              <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                <div className="flex justify-between"><span>Rows</span><span className="text-white">{csvRows.length}</span></div>
                <div className="flex justify-between"><span>Scenario</span><span className="text-purple-300 truncate max-w-[120px]">{selectedSuite ? selectedSuite.name : selectedScript?.name}</span></div>
                <div className="flex justify-between"><span>Steps</span><span className="text-cyan-300">{selectedSuite ? suiteScripts.length : 1}</span></div>
                <div className="flex justify-between"><span>Concurrency</span><span className="text-orange-400">{concurrency}×</span></div>
                {missingCols.length > 0 && (
                  <div className="text-red-400 pt-1">⚠ Missing: {missingCols.map(c => `{{${c}}}`).join(', ')}</div>
                )}
              </div>
            )}

            <Button onClick={runBulkTest} disabled={!canRun}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold gap-2 disabled:opacity-40">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {running ? `Running… (${runProgress.done}/${runProgress.total})` : csvRows.length > 0 ? `Run ${csvRows.length} Row${csvRows.length > 1 ? 's' : ''}` : 'Upload CSV to run'}
            </Button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <a href="/reports" className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-3 hover:bg-gray-800 transition-colors">
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" /> Test Report Dashboard</div>
                <div className="text-xs text-gray-500 mt-0.5">View aggregated suite runs and success rates</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </a>
          </div>

          {(running || jobResults.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Results</span>
                {!running && <span className="text-xs text-gray-500">{doneCount} ok · {errorCount} failed</span>}
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
                    r.status === 'error' ? 'bg-red-500/10' : r.status === 'running' ? 'bg-gray-800/60' : 'bg-emerald-500/5'
                  }`}>
                    {r.status === 'running' ? <Loader2 className="w-3 h-3 text-orange-400 animate-spin flex-shrink-0 mt-0.5" />
                      : r.status === 'error' ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                      : <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500">Row {r.rowIdx + 1}</span>
                        {Object.entries(r.row).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="text-gray-400">
                            <span className="text-gray-600">{k}=</span>{String(v).slice(0, 20)}
                          </span>
                        ))}
                      </div>
                      {r.sessionId && <div className="font-mono text-gray-500 truncate">{r.sessionId}</div>}
                      {r.scenarios?.length > 0 && <div className="text-gray-600">{r.scenarios.length} scenario step{r.scenarios.length !== 1 ? 's' : ''}</div>}
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