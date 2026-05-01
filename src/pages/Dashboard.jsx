import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { formatBytes, formatDuration, getCircuitState } from '@/lib/bbClient';
import { useBrowserbaseSessions, useBrowserbaseUsage } from '@/lib/browserbaseData';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { buildDashboardTestRunStats } from '@/lib/testRunDashboardStats';
import TestRunSummaryCharts from '@/components/dashboard/TestRunSummaryCharts';
import RoleAwareOnboarding from '@/components/onboarding/RoleAwareOnboarding';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StatusBadge from '@/components/shared/StatusBadge';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import ConcurrencyGauge from '@/components/dashboard/ConcurrencyGauge';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Activity, Clock, Globe, Zap, Layers, TrendingUp,
  Play, XCircle, CheckCircle, AlertCircle, Terminal, Shield, Flame, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const MATRIX_COLUMNS = Array.from({ length: 12 }, (_, i) => i);
const HEALTH_WAVE_BARS = Array.from({ length: 16 }, (_, i) => i);

export default function Dashboard() {
  const { isConfigured } = useCredentials();
  const [lastRefresh, setLastRefresh] = useState(null);
  const [apiStatus, setApiStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [apiLatency, setApiLatency] = useState(null);
  const [tick, setTick] = useState(0);
  const [circuit, setCircuit] = useState(() => getCircuitState());
  const online = useOnlineStatus();
  const sessionsQuery = useBrowserbaseSessions({ enabled: isConfigured && online, refetchInterval: 15_000 });
  const usageQuery = useBrowserbaseUsage({ enabled: isConfigured && online, refetchInterval: 30_000 });
  const bulkRunsQuery = useQuery({
    queryKey: ['dashboardAuthorizedBulkRuns'],
    queryFn: () => base44.entities.AuthorizedBulkQARun.list('-startedAt', 50),
    enabled: isConfigured,
    initialData: [],
    refetchInterval: 20_000,
  });
  const testRunsQuery = useQuery({
    queryKey: ['dashboardTestRuns'],
    // Tolerate legacy TestRun records that may be missing newly-required
    // fields under stricter SDK validation — fall back to an empty list so
    // a single bad row doesn't take down the whole dashboard.
    queryFn: () => base44.entities.TestRun.list('-startedAt', 50).catch(() => []),
    enabled: isConfigured,
    initialData: [],
    refetchInterval: 20_000,
  });
  const sessions = Array.isArray(sessionsQuery.data) ? sessionsQuery.data : [];
  const usage = usageQuery.data || null;
  const loading = sessionsQuery.isFetching || usageQuery.isFetching;
  const refetchSessions = sessionsQuery.refetch;
  const refetchUsage = usageQuery.refetch;

  const load = useCallback(async () => {
    if (!isConfigured || !online) return;
    const start = Date.now();
    const [sess] = await Promise.allSettled([
      refetchSessions(),
      refetchUsage(),
    ]);
    if (sess.status === 'fulfilled' && !sess.value.error) {
      setApiStatus('ok');
      setApiLatency(Date.now() - start);
    } else {
      setApiStatus('error');
    }
    setLastRefresh(new Date());
  }, [isConfigured, online, refetchSessions, refetchUsage]);

  useEffect(() => {
    if (sessionsQuery.isSuccess) {
      setApiStatus('ok');
      setLastRefresh(new Date());
    } else if (sessionsQuery.isError) {
      setApiStatus('error');
      setLastRefresh(new Date());
    }
  }, [sessionsQuery.isSuccess, sessionsQuery.isError, sessionsQuery.dataUpdatedAt, sessionsQuery.errorUpdatedAt]);

  // Waveform tick
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCircuit(getCircuitState()), 2000);
    return () => clearInterval(t);
  }, []);

  const testApi = useCallback(async () => {
    if (!isConfigured) return;
    setApiStatus('testing');
    setApiLatency(null);
    const start = Date.now();
    try {
      const result = await refetchSessions();
      if (result.error) throw result.error;
      setApiLatency(Date.now() - start);
      setApiStatus('ok');
    } catch {
      setApiStatus('error');
    }
  }, [isConfigured, refetchSessions]);

  const metrics = useMemo(() => {
    let running = 0, pending = 0, completed = 0, errors = 0;
    for (const session of sessions) {
      if (session.status === 'RUNNING') running++;
      else if (session.status === 'PENDING') pending++;
      else if (session.status === 'COMPLETED') completed++;
      else if (session.status === 'ERROR' || session.status === 'TIMED_OUT') errors++;
    }
    // Sort once at the end (not per-row) and slice — was previously O(n² log n)
    // because we re-sorted on every push inside the loop.
    const recentSessions = [...sessions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);
    return { running, pending, completed, errors, total: sessions.length, recentSessions };
  }, [sessions]);

  const testRunStats = useMemo(
    () => buildDashboardTestRunStats(bulkRunsQuery.data || [], testRunsQuery.data || []),
    [bulkRunsQuery.data, testRunsQuery.data]
  );
  const { running, pending, completed, errors, total, recentSessions } = metrics;
  const barTotal = total || 1;
  const healthPct = total === 0 ? 100 : Math.max(0, Math.round(((total - errors) / total) * 100));

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <div className="min-h-full bg-gray-950 relative overflow-hidden">
      {/* Matrix rain bg */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        {MATRIX_COLUMNS.map((i) => (
          <div key={i} className="absolute top-0 text-emerald-400 text-xs font-mono leading-4 select-none"
            style={{ left: `${(i / 12) * 100}%`, opacity: 0.6 }}>
            {'10100110010110101001011010'.split('').join('\n')}
          </div>
        ))}
      </div>

      <div className="relative z-10 p-6 space-y-5">
        <RoleAwareOnboarding />

        {/* Header */}
        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5" />
          <div className="relative flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-black tracking-wider text-white uppercase">BB Command Center</h1>
                  <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 font-mono bg-emerald-500/10">LIVE</span>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {lastRefresh ? `LAST SYNC: ${formatDistanceToNow(lastRefresh)} ago` : 'INITIALIZING…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${running > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className="text-xs font-mono text-gray-300">{running} LIVE</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${circuit.state === 'closed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                <div className={`w-2 h-2 rounded-full ${circuit.state === 'closed' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-xs font-mono">CB {circuit.state.toUpperCase()}</span>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}
                className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-2 font-mono text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                REFRESH
              </Button>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'RUNNING',     value: running,   icon: Activity,   color: 'emerald', glow: running > 0 },
            { label: 'PENDING',     value: pending,   icon: Clock,      color: 'yellow',  glow: false },
            { label: 'ERRORS',      value: errors,    icon: XCircle,    color: 'red',     glow: errors > 0 },
            { label: 'BROWSER MIN', value: usage ? usage.browserMinutes?.toLocaleString() : '—', icon: TrendingUp, color: 'cyan', glow: false,
              sub: usage ? formatBytes(usage.proxyBytes) + ' proxy' : 'Loading…' },
          ].map(({ label, value, icon: Icon, color, glow, sub }) => {
            const c = {
              emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', icon: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
              yellow:  { border: 'border-yellow-500/30',  bg: 'bg-yellow-500/5',  text: 'text-yellow-400',  icon: 'bg-yellow-500/10',  glow: 'shadow-yellow-500/20' },
              red:     { border: 'border-red-500/30',     bg: 'bg-red-500/5',     text: 'text-red-400',     icon: 'bg-red-500/10',     glow: 'shadow-red-500/20' },
              cyan:    { border: 'border-cyan-500/30',    bg: 'bg-cyan-500/5',    text: 'text-cyan-400',    icon: 'bg-cyan-500/10',    glow: 'shadow-cyan-500/20' },
            }[color];
            return (
              <div key={label} className={`relative rounded-xl border ${c.border} ${c.bg} p-4 ${glow ? `shadow-lg ${c.glow}` : ''} overflow-hidden`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                  {glow && <div className={`w-2 h-2 rounded-full ${color === 'emerald' ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />}
                </div>
                <div className={`text-2xl font-black ${c.text} font-mono`}>{value}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{label}</div>
                {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
              </div>
            );
          })}
        </div>

        <ConcurrencyGauge active={running} max={50} />

        <TestRunSummaryCharts stats={testRunStats} />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Sessions */}
          <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-emerald-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">RECENT SESSIONS</span>
              </div>
              <Link to="/sessions" className="text-xs text-emerald-400 hover:text-emerald-300 font-mono border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/10 transition-colors">
                VIEW ALL →
              </Link>
            </div>
            <div className="divide-y divide-gray-800/60">
              {recentSessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-gray-600">
                  <Terminal className="w-8 h-8 mb-2 opacity-30" />
                  <span className="text-sm font-mono">{loading ? 'LOADING…' : 'NO SESSIONS DETECTED'}</span>
                </div>
              )}
              {recentSessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors group">
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-800 text-gray-600 text-xs font-mono flex-shrink-0">{i + 1}</div>
                  <StatusBadge status={s.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-300 truncate group-hover:text-white transition-colors">{s.id}</div>
                    <div className="text-xs text-gray-600 font-mono">{s.region} · {s.startedAt ? formatDuration(s.startedAt, s.endedAt) : 'NOT STARTED'}</div>
                  </div>
                  <div className="text-xs text-gray-700 font-mono flex-shrink-0">{formatDistanceToNow(new Date(s.createdAt))} ago</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-3">
            {/* Quick launch */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 rounded-full bg-cyan-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">QUICK LAUNCH</span>
              </div>
              <Link to="/au-casino">
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2 justify-start font-mono text-xs shadow-lg shadow-amber-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> AU CASINO DUAL LAUNCH
                </Button>
              </Link>
              <Link to="/bulk">
                <Button className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold gap-2 justify-start font-mono text-xs shadow-lg shadow-orange-500/30">
                  <Flame className="w-3.5 h-3.5" /> AUTHORIZED BULK QA
                </Button>
              </Link>
              <Link to="/fleet">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold gap-2 justify-start font-mono text-xs shadow-lg shadow-emerald-500/20">
                  <Zap className="w-3.5 h-3.5" /> FLEET LAUNCHER
                </Button>
              </Link>
              <Link to="/mirror">
                <Button variant="outline" className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 gap-2 justify-start font-mono text-xs">
                  <Globe className="w-3.5 h-3.5" /> MIRROR MODE
                </Button>
              </Link>
              <Link to="/stagehand">
                <Button variant="outline" className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 justify-start font-mono text-xs">
                  <Play className="w-3.5 h-3.5" /> STAGEHAND AI
                </Button>
              </Link>
              <Link to="/contexts">
                <Button variant="outline" className="w-full border-gray-700 text-gray-400 hover:bg-gray-800 gap-2 justify-start font-mono text-xs">
                  <Layers className="w-3.5 h-3.5" /> CONTEXTS
                </Button>
              </Link>
            </div>

            {/* API Health */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-yellow-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">API HEALTH</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-mono ${
                  apiStatus === 'ok'      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  apiStatus === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  apiStatus === 'testing' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                  'bg-gray-800 border-gray-700 text-gray-500'
                }`}>
                  {apiStatus === 'ok'      && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {apiStatus === 'error'   && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {apiStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />}
                  {!apiStatus             && <Shield className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span>
                    {apiStatus === 'ok'      ? (apiLatency != null ? `OK · ${apiLatency}ms` : 'OK') :
                     apiStatus === 'error'   ? 'ERROR — check credentials' :
                     apiStatus === 'testing' ? 'PINGING…' :
                     'NOT TESTED'}
                  </span>
                </div>
                <Button size="sm" onClick={testApi} disabled={apiStatus === 'testing'}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs h-8 px-3 font-mono">
                  TEST
                </Button>
              </div>
            </div>

            {/* Fleet health */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-4 rounded-full bg-pink-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">FLEET HEALTH</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'RUNNING',   count: running,   color: 'bg-emerald-400' },
                  { label: 'PENDING',   count: pending,   color: 'bg-yellow-400' },
                  { label: 'COMPLETED', count: completed, color: 'bg-cyan-400' },
                  { label: 'ERRORS',    count: errors,    color: 'bg-red-400' },
                ].map(({ label, count, color }) => {
                  const pct = Math.round((count / barTotal) * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-gray-300">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* System health bar */}
        <div className="rounded-xl border border-emerald-500/20 bg-gray-900/80 px-5 py-3 flex items-center gap-4">
          <span className="text-xs font-black font-mono text-emerald-400 flex-shrink-0 tracking-wider">SYSTEM HEALTH</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow shadow-emerald-500/50 transition-all duration-1000"
              style={{ width: `${healthPct}%` }} />
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {HEALTH_WAVE_BARS.map((i) => (
              <div key={i} className="w-0.5 bg-emerald-500 rounded-full transition-all duration-300"
                style={{ height: `${4 + Math.abs(Math.sin((tick + i) * 0.8)) * 12}px`, opacity: 0.6 + Math.abs(Math.sin((tick + i) * 0.5)) * 0.4 }} />
            ))}
          </div>
          <span className="text-sm font-black font-mono text-emerald-400 flex-shrink-0">{healthPct}%</span>
        </div>

      </div>
    </div>
  );
}