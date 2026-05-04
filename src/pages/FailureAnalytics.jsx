import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import ApiErrorState from '@/components/shared/ApiErrorState';
import EmptyState from '@/components/shared/EmptyState';
import FailureAnalyticsMetric from '@/components/analytics/FailureAnalyticsMetric';
import FailureBreakdownList from '@/components/analytics/FailureBreakdownList';
import { buildFailureAnalytics } from '@/lib/failureAnalytics';

export default function FailureAnalytics() {
  const { data: runs = [], isFetching, isError, error, refetch } = useQuery({
    queryKey: ['failureAnalyticsRuns'],
    queryFn: () => base44.entities.AuthorizedBulkQARun.list('-startedAt', 250),
    initialData: [],
    refetchInterval: 30_000,
  });

  const analytics = useMemo(() => buildFailureAnalytics(runs), [runs]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Failure Analytics</h1>
            <p className="text-sm text-gray-500">Failure rates over time, grouped by failure type and target host.</p>
          </div>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isError ? (
        <ApiErrorState title="Could not load failure analytics" error={error?.message} onRetry={refetch} />
      ) : runs.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No QA runs yet" description="Run Authorized QA checks and failure analytics will appear here." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FailureAnalyticsMetric label="Rows analyzed" value={analytics.totalRows} />
            <FailureAnalyticsMetric label="Failures + reviews" value={analytics.failureRows} tone="warn" />
            <FailureAnalyticsMetric label="Failure rate" value={`${analytics.failureRate}%`} tone="danger" />
            <FailureAnalyticsMetric label="Targets affected" value={analytics.targetHosts.length} />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-white">Failure rate over time</div>
                <div className="text-xs text-gray-500">Daily failed/review rows as a percentage of total rows.</div>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.timeline} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="failureRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, color: '#f9fafb' }}
                    formatter={(value, name) => [name === 'failureRate' ? `${value}%` : value, name === 'failureRate' ? 'Failure rate' : name]}
                  />
                  <Area type="monotone" dataKey="failureRate" stroke="#ef4444" fill="url(#failureRate)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FailureBreakdownList title="Failures by type" items={analytics.failureTypes} emptyLabel="No categorized failures yet." />
            <FailureBreakdownList title="Failures by target host" items={analytics.targetHosts} emptyLabel="No target host failures yet." />
          </div>
        </>
      )}
    </div>
  );
}