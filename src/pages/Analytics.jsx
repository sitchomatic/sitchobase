import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient, BB_COST_PER_MINUTE } from '@/lib/bbClient';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import MetricCard from '@/components/shared/MetricCard';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Clock, Globe, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subHours } from 'date-fns';

const COLORS = ['#10b981','#f59e0b','#ef4444','#6b7280','#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const [sess, usg] = await Promise.allSettled([
      bbClient.listSessions(),
      bbClient.getProjectUsage(),
    ]);
    if (sess.status === 'fulfilled') setSessions(Array.isArray(sess.value) ? sess.value : []);
    if (usg.status === 'fulfilled') setUsage(usg.value);
    setLoading(false);
  }, [isConfigured]);

  useEffect(() => { load(); }, [load]);

  if (!isConfigured) return <CredentialsGuard />;

  // Derived stats
  const byStatus = ['RUNNING','PENDING','COMPLETED','ERROR','TIMED_OUT'].map(s => ({
    name: s,
    value: sessions.filter(x => x.status === s).length,
  })).filter(d => d.value > 0);

  const regionLabelMap = {
    'us-west-2': 'USW', 'us-east-1': 'USE', 'eu-central-1': 'EU',
    'ap-southeast-1': 'AP', 'au': 'AU',
  };
  const byRegion = Object.entries(regionLabelMap).map(([r, label]) => ({
    region: label,
    count: sessions.filter(s => s.region === r).length,
  })).filter(d => d.count > 0);

  // Hourly activity from real session data
  const hourlyMap = {};
  sessions.forEach(s => {
    const h = format(new Date(s.createdAt), 'HH:00');
    hourlyMap[h] = (hourlyMap[h] || 0) + 1;
  });
  const activityData = Array.from({ length: 12 }, (_, i) => {
    const hour = format(subHours(new Date(), 11 - i), 'HH:00');
    return { hour, sessions: hourlyMap[hour] || 0 };
  });

  const totalProxyMB = usage ? (usage.proxyBytes / 1024 / 1024).toFixed(2) : 0;
  const completedSessions = sessions.filter(s => s.startedAt && s.endedAt);
  const avgDuration = completedSessions.length > 0
    ? completedSessions.reduce((acc, s) => acc + (new Date(s.endedAt) - new Date(s.startedAt)) / 1000, 0) / completedSessions.length
    : 0;
  const estimatedCost = usage?.browserMinutes
    ? `$${(usage.browserMinutes * BB_COST_PER_MINUTE).toFixed(3)}`
    : '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics & Burn-Rate</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time usage and cost tracking · {sessions.length} total sessions</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Sessions" value={sessions.length} icon={Activity} accent="emerald" />
        <MetricCard label="Browser Minutes" value={usage?.browserMinutes?.toLocaleString() ?? '—'} icon={Clock} accent="blue" />
        <MetricCard label="Proxy Used" value={`${totalProxyMB} MB`} icon={Globe} accent="purple" />
        <MetricCard label="Avg Duration" value={`${Math.round(avgDuration)}s`} icon={TrendingUp} accent="orange" />
        <MetricCard label="Est. Cost" value={estimatedCost} icon={TrendingUp} accent="emerald" sub={`@ $${BB_COST_PER_MINUTE}/min`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">Session Activity (Last 12h)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sessions" stroke="#10b981" fill="url(#grad)" name="Sessions" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">Status Distribution</div>
          {byStatus.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">{loading ? 'Loading…' : 'No data yet'}</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {byStatus.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-gray-300 font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {byRegion.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">Sessions by Region</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byRegion} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="region" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}