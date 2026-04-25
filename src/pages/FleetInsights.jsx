import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useCredentials } from '@/lib/useCredentials';
import { useBrowserbaseSessions } from '@/lib/browserbaseData';
import { buildFleetInsights } from '@/lib/fleetInsights';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import FleetMetricCard from '@/components/fleetInsights/FleetMetricCard';
import FleetChartPanel from '@/components/fleetInsights/FleetChartPanel';
import FleetRecentActivity from '@/components/fleetInsights/FleetRecentActivity';

const COLORS = ['#10b981', '#22d3ee', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 shadow-xl">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function FleetInsights() {
  const { isConfigured } = useCredentials();
  const { data: sessions = [], isFetching, refetch } = useBrowserbaseSessions({ enabled: isConfigured, refetchInterval: 20_000 });
  const insights = useMemo(() => buildFleetInsights(Array.isArray(sessions) ? sessions : []), [sessions]);

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <div className="min-h-full bg-gray-950 p-6 space-y-5">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide">Fleet Insights</h1>
            <p className="text-sm text-gray-500">Success rates, status mix, region load, and recent browser activity trends.</p>
          </div>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FleetMetricCard label="Success Rate" value={`${insights.successRate}%`} sub={`${insights.totals.success}/${insights.totals.total} completed`} />
        <FleetMetricCard label="Health Score" value={`${insights.healthScore}%`} sub="Weighted fleet reliability" tone="cyan" />
        <FleetMetricCard label="Active" value={insights.totals.active} sub="Running or pending sessions" tone="yellow" />
        <FleetMetricCard label="Failures" value={insights.totals.failed} sub={`${insights.failureRate}% failure rate`} tone={insights.totals.failed ? 'red' : 'emerald'} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FleetChartPanel title="Recent Session Trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.dailyTrend} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#10b981" fill="url(#sessionsFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </FleetChartPanel>

        <FleetChartPanel title="Status Breakdown">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={insights.statusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={86} paddingAngle={4}>
                {insights.statusBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </FleetChartPanel>

        <FleetChartPanel title="Region Load">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={insights.regionBreakdown} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="region" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Sessions" fill="#22d3ee" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </FleetChartPanel>

        <FleetRecentActivity items={insights.recent} />
      </motion.div>
    </div>
  );
}