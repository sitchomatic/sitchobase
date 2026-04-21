import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { listSessions, getProjectUsage, formatBytes } from '@/lib/browserbaseApi';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import MetricCard from '@/components/shared/MetricCard';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, Globe, Activity, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subHours } from 'date-fns';

const COLORS = ['#10b981','#f59e0b','#ef4444','#6b7280','#8b5cf6'];

export default function Analytics() {
  const { credentials, isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const [sess, usg] = await Promise.allSettled([
      listSessions(credentials.apiKey),
      getProjectUsage(credentials.apiKey, credentials.projectId),
    ]);
    if (sess.status === 'fulfilled') setSessions(sess.value);
    if (usg.status === 'fulfilled') setUsage(usg.value);
    setLoading(false);
  }, [credentials, isConfigured]);

  useEffect(() => { load(); }, [load]);

  if (!isConfigured) return <CredentialsGuard />;

  // Derived stats
  const byStatus = ['RUNNING','PENDING','COMPLETED','ERROR','TIMED_OUT'].map(s => ({
    name: s,
    value: sessions.filter(x => x.status === s).length,
  })).filter(d => d.value > 0);

  const byRegion = ['us-west-2','us-east-1','eu-central-1','ap-southeast-1'].map(r => ({
    region: r.replace('us-west-2','USW').replace('us-east-1','USE').replace('eu-central-1','EU').replace('ap-southeast-1','AP'),
    count: sessions.filter(s => s.region === r).length,
  })).filter(d => d.count > 0);

  // Simulate hourly burn rate data
  const burnData = Array.from({ length: 12 }, (_, i) => {
    const hour = subHours(new Date(), 11 - i);
    const running = Math.floor(Math.random() * 15);
    return {
      hour: format(hour, 'HH:mm'),
      sessions: running,
      minutes: running * 5,
    };
  });

  const totalProxyMB = usage ? (usage.proxyBytes / 1024 / 1024).toFixed(2) : 0;
  const avgDuration = sessions.filter(s => s.startedAt && s.endedAt).reduce((acc, s) => {
    return acc + (new Date(s.endedAt) - new Date(s.startedAt)) / 1000;
  }, 0) / Math.max(sessions.filter(s => s.endedAt).length, 1);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics & Burn-Rate</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time usage and cost tracking</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Sessions" value={sessions.length} icon={Activity} accent="emerald" />
        <MetricCard label="Browser Minutes" value={usage?.browserMinutes?.toLocaleString() ?? '—'} icon={Clock} accent="blue" />
        <MetricCard label="Proxy Used" value={`${totalProxyMB} MB`} icon={Globe} accent="purple" />
        <MetricCard label="Avg Duration" value={`${Math.round(avgDuration)}s`} icon={TrendingUp} accent="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Burn rate */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">Session Activity (Last 12h)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={burnData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sessions" stroke="#10b981" fill="url(#grad)" name="Sessions" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">Status Distribution</div>
          {byStatus.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">No data yet</div>
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

      {/* Region breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="text-sm font-semibold text-white mb-4">Sessions by Region</div>
        {byRegion.length === 0 ? (
          <div className="text-center py-6 text-gray-600 text-xs">No region data</div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byRegion} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="region" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}