import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Loader2, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Bulletproof diagnose panel — runs every API key source × auth header
 * variant against Browserbase and shows which combo works. Helps users
 * self-recover from stale server secrets, wrong project IDs, or header drift.
 */
export default function DiagnosePanel({ projectId, apiKey }) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  const run = async () => {
    setRunning(true);
    setReport(null);
    try {
      const res = await base44.functions.invoke('bbProxy', {
        action: 'diagnose',
        projectId,
        apiKeyOverride: apiKey,
      });
      const env = res?.data ?? {};
      if (env.ok === false && env.error) {
        toast.error(env.error);
        setReport({ ok: false, error: env.error });
      } else {
        setReport(env.data ?? env);
      }
    } catch (err) {
      toast.error(`Diagnose failed: ${err.message}`);
      setReport({ ok: false, error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-cyan-400" /> Credential Diagnostics
        </div>
        <Button
          onClick={run}
          disabled={running}
          size="sm"
          variant="outline"
          title="Check all Browserbase credential sources and report which one works"
          aria-label="Diagnose Browserbase credential configuration"
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
          {running ? 'Diagnosing…' : 'Diagnose Credentials'}
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Tests every API key source (server secret + your saved key) against every Browserbase auth header variant
        to identify exactly what's failing and how to fix it.
      </p>

      {report && (
        <div className="space-y-2">
          <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm ${
            report.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}>
            {report.ok
              ? <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div>
              <div className="font-semibold">{report.ok ? 'Working configuration found' : 'No working configuration'}</div>
              {report.recommendation && (
                <div className="text-xs mt-0.5 opacity-90">{report.recommendation}</div>
              )}
              {report.error && <div className="text-xs mt-0.5 opacity-80">{report.error}</div>}
            </div>
          </div>

          {report.working && (
            <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
              <div className="font-semibold text-gray-200 mb-1">Best match</div>
              <div>Source: <code className="text-emerald-400">{report.working.source}</code></div>
              <div>Header: <code className="text-emerald-400">{report.working.header}</code></div>
              <div>Latency: <code className="text-emerald-400">{report.working.ms}ms</code></div>
            </div>
          )}

          {report.projectMatch && (
            <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3 flex items-center gap-2">
              {report.projectMatch.ok
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
              <span>Project ID match: <span className={report.projectMatch.ok ? 'text-emerald-400' : 'text-red-400'}>
                {report.projectMatch.ok ? 'OK' : `failed (${report.projectMatch.status || report.projectMatch.error})`}
              </span></span>
            </div>
          )}

          {Array.isArray(report.results) && report.results.length > 0 && (
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-300">
                Detailed results ({report.results.length} combos tested)
              </summary>
              <div className="mt-2 space-y-1">
                {report.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/50">
                    {r.ok
                      ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    <Badge variant="outline" className="text-[10px] py-0 border-gray-700 text-gray-400">{r.source}</Badge>
                    <code className="text-gray-300 flex-1 truncate">{r.header}</code>
                    <span className={r.ok ? 'text-emerald-400' : 'text-gray-500'}>
                      {r.status || 'err'}{r.ms ? ` · ${r.ms}ms` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}