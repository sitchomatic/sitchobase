/**
 * Diagnostics — parses every failed run we can see (JoeIgniteRun,
 * AuthorizedBulkQARun rows, in-memory monitoringLog), classifies each
 * failure into a known pattern (CAPTCHA, site update, account lock, proxy
 * ban, rate-limit, timeout, etc.), and surfaces a remediation card per
 * pattern with a one-click swap suggestion (rotate proxy / pick fresh
 * credential / fix selectors).
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Stethoscope, RefreshCw, CheckCircle2, AlertTriangle, FileJson, FileSpreadsheet } from 'lucide-react';
import { loadFailedRecords } from '@/lib/diagnostics/sources';
import { clusterFailures } from '@/lib/diagnostics/patterns';
import { subscribe as subscribeLogs } from '@/lib/monitoringLog';
import { exportCompleteJSON, exportCompleteCSV } from '@/lib/diagnostics/exporter';
import PatternClusterCard from '@/components/diagnostics/PatternClusterCard';
import SmartRetryDialog from '@/components/diagnostics/SmartRetryDialog';

export default function Diagnostics() {
  const [tick, setTick] = useState(0);
  const [retryRecord, setRetryRecord] = useState(null);
  const [retryRemedy, setRetryRemedy] = useState(null);

  // Re-aggregate when the in-memory monitoring log changes.
  useEffect(() => subscribeLogs(() => setTick((t) => t + 1)), []);

  const failuresQuery = useQuery({
    queryKey: ['diagnosticsFailedRecords', tick],
    queryFn: () => loadFailedRecords({ limit: 200 }),
    initialData: [],
    staleTime: 30_000,
  });

  const proxiesQuery = useQuery({
    queryKey: ['diagnosticsHealthyProxies'],
    queryFn: () => base44.entities.ProxyPool.filter({ enabled: true }, '-created_date', 100).catch(() => []),
    initialData: [],
    staleTime: 60_000,
  });

  const credsQuery = useQuery({
    queryKey: ['diagnosticsCredentials'],
    queryFn: () => base44.entities.CasinoCredential.filter({ isBurned: false }, '-updated_date', 200).catch(() => []),
    initialData: [],
    staleTime: 60_000,
  });

  const refresh = useCallback(() => {
    failuresQuery.refetch();
    proxiesQuery.refetch();
    credsQuery.refetch();
  }, [failuresQuery, proxiesQuery, credsQuery]);

  const ctx = useMemo(() => ({
    proxyHealthy: (proxiesQuery.data || []).filter((p) =>
      !p.healthStatus || p.healthStatus === 'healthy' || p.healthStatus === 'unknown'
    ).length,
    credentialsAvailable: (credsQuery.data || []).length,
  }), [proxiesQuery.data, credsQuery.data]);

  const clusters = useMemo(() => clusterFailures(failuresQuery.data || []), [failuresQuery.data]);
  const total = (failuresQuery.data || []).length;
  const loading = failuresQuery.isFetching;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-400" /> Diagnostics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Parses failed runs across Joe/Ignite, Authorized Bulk QA, and Browser Monitoring. Groups them by failure pattern and suggests the fastest swap to retry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => exportCompleteJSON(failuresQuery.data || [], ctx)}
            disabled={total === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <FileJson className="w-3.5 h-3.5" /> Export JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCompleteCSV(failuresQuery.data || [])}
            disabled={total === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-scan
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Failures analysed" value={total} />
        <Stat label="Patterns detected" value={clusters.length} />
        <Stat label="Healthy proxies" value={ctx.proxyHealthy} accent="emerald" />
        <Stat label="Available credentials" value={ctx.credentialsAvailable} accent="emerald" />
      </div>

      {loading && total === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">Scanning failed runs…</div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-10 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <div className="text-sm text-emerald-300 font-semibold">No failures detected</div>
          <p className="text-xs text-gray-500 max-w-md">
            All recent runs across Joe/Ignite, Authorized Bulk QA, and Browser Monitoring look clean. Great work.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.length === 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div className="text-xs text-amber-200">
                {total} failures found but none matched a known pattern. Check the audit log for raw details.
              </div>
            </div>
          )}
          {clusters.map((cluster) => (
            <PatternClusterCard
              key={cluster.kind}
              cluster={cluster}
              ctx={ctx}
              onSmartRetry={(rec, remedy) => { setRetryRecord(rec); setRetryRemedy(remedy); }}
            />
          ))}
        </div>
      )}

      <SmartRetryDialog
        open={!!retryRecord}
        onOpenChange={(o) => { if (!o) { setRetryRecord(null); setRetryRemedy(null); } }}
        record={retryRecord}
        suggestedSwap={retryRemedy}
        proxies={proxiesQuery.data || []}
        credentials={credsQuery.data || []}
      />
    </div>
  );
}

function Stat({ label, value, accent = 'gray' }) {
  const accentCls = accent === 'emerald' ? 'text-emerald-300' : 'text-gray-200';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accentCls}`}>{value}</div>
    </div>
  );
}