import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BB_COST_PER_MINUTE } from '@/lib/bbClient';
import { computeProxyEfficiency } from '@/lib/proxyEfficiency';
import ProxyEfficiencyHeader from '@/components/proxies/ProxyEfficiencyHeader';
import ProxyEfficiencySummary from '@/components/proxies/ProxyEfficiencySummary';
import ProxyEfficiencyTable from '@/components/proxies/ProxyEfficiencyTable';

const WINDOW_DAYS = 30;

export default function ProxyEfficiency() {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - WINDOW_DAYS);
    return d.toISOString();
  }, []);

  const { data: runs = [], isFetching: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['joe-ignite-runs-30d', since],
    queryFn: () => base44.entities.JoeIgniteRun.filter({ created_date: { $gte: since } }, '-created_date', 2000),
    initialData: [],
  });

  const { data: proxies = [], isFetching: proxiesLoading, refetch: refetchProxies } = useQuery({
    queryKey: ['proxyPool'],
    queryFn: () => base44.entities.ProxyPool.list('-created_date', 500),
    initialData: [],
  });

  const rows = useMemo(
    () => computeProxyEfficiency({ runs, proxies, costPerMin: BB_COST_PER_MINUTE }),
    [runs, proxies]
  );

  const loading = runsLoading || proxiesLoading;

  const refresh = () => { refetchRuns(); refetchProxies(); };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <ProxyEfficiencyHeader windowDays={WINDOW_DAYS} runCount={runs.length} onRefresh={refresh} loading={loading} />
      <ProxyEfficiencySummary rows={rows} />
      <ProxyEfficiencyTable rows={rows} />

      <div className="text-[11px] text-gray-600 bg-gray-900/40 border border-gray-800 rounded-lg px-3 py-2 leading-relaxed">
        <strong className="text-gray-400">Notes:</strong>{' '}
        Success rate = successful logins / (success + failure). Latency is the mean
        end-to-end Browserbase session duration (proxy for real-world proxy speed).
        Cost is calculated as session minutes × ${BB_COST_PER_MINUTE.toFixed(3)}/min.
        Providers are inferred from proxy server hostname or label.
      </div>
    </div>
  );
}