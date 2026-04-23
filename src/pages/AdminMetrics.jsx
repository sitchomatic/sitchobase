/**
 * /admin/metrics — daily aggregates from DailyMetric entity (#17).
 * Admin-only view. Shows the last 14 days of counts, error rates, avg latency.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3, TrendingUp, AlertCircle, Clock, Download } from 'lucide-react';
import { parseDailyMetric, safeParseMany } from '@/lib/safeParse';
import { queryKeys } from '@/lib/queryKeys';
import { toCsv, downloadText } from '@/lib/adminExports';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminMetrics() {
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: queryKeys.adminMetrics,
    queryFn: async () => {
      const rows = await base44.entities.DailyMetric.list('-date', 500);
      return safeParseMany(rows, parseDailyMetric, 'dailyMetric');
    },
    initialData: [],
    staleTime: 60_000,
  });

  const exportMetrics = () => {
    downloadText('daily-metrics.csv', toCsv(metrics));
  };

  // Group by date
  const byDate = {};
  metrics.forEach((m) => {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  });
  const dates = Object.keys(byDate).sort().slice(-14).reverse();

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Metrics</h1>
              <p className="text-xs text-gray-500">Daily bbProxy request aggregates (last 14 days)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportMetrics} className="border-gray-700 text-gray-300 gap-2">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Link to="/"><Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Dashboard</Button></Link>
          </div>
        </div>

        {isLoading && <div className="text-center text-gray-500 py-10">Loading…</div>}
        {!isLoading && dates.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-10 text-center text-gray-500">
            No metrics recorded yet. They'll appear after the next bbProxy call.
          </div>
        )}

        {dates.map((date) => {
          const rows = byDate[date] || [];
          const total = rows.find((r) => r.action === '__total__') || { count: 0, errors: 0, sum_duration_ms: 0 };
          const avg = total.count ? (total.sum_duration_ms / total.count).toFixed(0) : '—';
          const errRate = total.count ? ((total.errors / total.count) * 100).toFixed(1) : '0.0';
          const perAction = rows.filter((r) => r.action !== '__total__').sort((a, b) => b.count - a.count);
          return (
            <div key={date} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="text-sm font-semibold text-white">{date}</div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-cyan-400"><TrendingUp className="w-3 h-3" />{total.count} calls</div>
                  <div className="flex items-center gap-1.5 text-red-400"><AlertCircle className="w-3 h-3" />{errRate}% err</div>
                  <div className="flex items-center gap-1.5 text-gray-400"><Clock className="w-3 h-3" />avg {avg}ms</div>
                </div>
              </div>
              <div className="divide-y divide-gray-800/60 text-xs">
                {perAction.map((r) => (
                  <div key={r.action} className="flex items-center justify-between px-4 py-2">
                    <span className="font-mono text-gray-300">{r.action}</span>
                    <div className="flex items-center gap-4 text-gray-500">
                      <span>{r.count} calls</span>
                      <span className={r.errors > 0 ? 'text-red-400' : ''}>{r.errors} err</span>
                      <span>max {r.max_duration_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}