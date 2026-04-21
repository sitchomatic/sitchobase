import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { listSessions, getProjectUsage, formatBytes } from '@/lib/browserbaseApi';
import MetricCard from '@/components/shared/MetricCard';
import StatusBadge from '@/components/shared/StatusBadge';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, Clock, Globe, Zap, Layers, TrendingUp, Play, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { credentials, isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const [sess, usg] = await Promise.allSettled([
        listSessions(credentials.apiKey),
        getProjectUsage(credentials.apiKey, credentials.projectId),
      ]);
      if (sess.status === 'fulfilled') setSessions(Array.isArray(sess.value) ? sess.value : []);
      if (usg.status === 'fulfilled') setUsage(usg.value);
    } catch (err) {
      console.error('Dashboard load error:', err.message);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, [credentials, isConfigured]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load, isConfigured]);

  if (!isConfigured) return <CredentialsGuard />;

  const running = sessions.filter(s => s.status === 'RUNNING').length;
  const pending = sessions.filter(s => s.status === 'PENDING').length;
  const errors  = sessions.filter(s => s.status === 'ERROR' || s.status === 'TIMED_OUT').length;
  const recentSessions = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastRefresh ? `Last updated ${formatDistanceToNow(lastRefresh)} ago` : 'Loading…'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Running Sessions" value={running} icon={Activity} accent="emerald" sub="Live browser instances" />
        <MetricCard label="Pending" value={pending} icon={Clock} accent="yellow" sub="Waiting to start" />
        <MetricCard label="Errors" value={errors} icon={XCircle} accent="red" sub="Failed or timed out" />
        <MetricCard
          label="Browser Minutes"
          value={usage ? `${usage.browserMinutes.toLocaleString()}` : '—'}
          icon={TrendingUp}
          accent="blue"
          sub={usage ? `${formatBytes(usage.proxyBytes)} proxy used` : 'Loading…'}
        />
      </div>

      {/* Session grid + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Recent Sessions</span>
            <Link to="/sessions" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {recentSessions.length === 0 && (
              <div className="text-center py-10 text-gray-500 text-sm">No sessions yet</div>
            )}
            {recentSessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/50 transition-colors">
                <StatusBadge status={s.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-300 truncate">{s.id}</div>
                  <div className="text-xs text-gray-500">
                    {s.region} · {s.startedAt ? formatDuration(s.startedAt, s.endedAt) : 'Not started'}
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {formatDistanceToNow(new Date(s.createdAt))} ago
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-white">Quick Launch</div>
            <Link to="/fleet">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2 justify-start">
                <Zap className="w-4 h-4" /> Launch Fleet
              </Button>
            </Link>
            <Link to="/mirror">
              <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 justify-start">
                <Globe className="w-4 h-4" /> Mirror Mode
              </Button>
            </Link>
            <Link to="/stagehand">
              <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 justify-start">
                <Play className="w-4 h-4" /> Stagehand AI
              </Button>
            </Link>
            <Link to="/contexts">
              <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 justify-start">
                <Layers className="w-4 h-4" /> Manage Contexts
              </Button>
            </Link>
          </div>

          {/* Status ring */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">Fleet Health</div>
            <div className="space-y-2">
              {[
                { label: 'Running', count: running, color: 'bg-emerald-500' },
                { label: 'Pending', count: pending, color: 'bg-yellow-500' },
                { label: 'Completed', count: sessions.filter(s => s.status === 'COMPLETED').length, color: 'bg-gray-500' },
                { label: 'Errors', count: errors, color: 'bg-red-500' },
              ].map(({ label, count, color }) => {
                const total = sessions.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{label}</span><span>{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}