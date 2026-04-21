import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { listSessions, getProjectUsage, formatBytes } from '@/lib/browserbaseApi';
import StatusBadge from '@/components/shared/StatusBadge';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, Clock, Globe, Zap, Layers, TrendingUp, Play, XCircle, CheckCircle, AlertCircle, Terminal, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { credentials, isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [apiLatency, setApiLatency] = useState(null);
  const [tick, setTick] = useState(0);

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

  const testApi = useCallback(async () => {
    if (!isConfigured) return;
    setApiStatus('testing');
    setApiLatency(null);
    const start = Date.now();
    try {
      await listSessions(credentials.apiKey);
      setApiLatency(Date.now() - start);
      setApiStatus('ok');
    } catch {
      setApiStatus('error');
    }
  }, [credentials, isConfigured]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load, isConfigured]);

  // Animate tick for pulse effects
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!isConfigured) return <CredentialsGuard />;

  const running = sessions.filter(s => s.status === 'RUNNING').length;
  const pending = sessions.filter(s => s.status === 'PENDING').length;
  const completed = sessions.filter(s => s.status === 'COMPLETED').length;
  const errors = sessions.filter(s => s.status === 'ERROR' || s.status === 'TIMED_OUT').length;
  const total = sessions.length || 1;
  const healthPct = total === 1 ? 100 : Math.max(0, Math.round(((total - errors) / total) * 100));
  const recentSessions = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  return (
    <div className="min-h-full bg-gray-950 relative overflow-hidden">
      {/* Matrix rain background effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 text-emerald-400 text-xs font-mono leading-4 select-none"
            style={{
              left: `${(i / 12) * 100}%`,
              animationDuration: `${3 + (i % 4)}s`,
              opacity: 0.6,
            }}
          >
            {'10100110010110101001011010'.split('').join('\n')}
          </div>
        ))}
      </div>

      <div className="relative z-10 p-6 space-y-5">

        {/* ═══ HEADER ═══ */}
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
                  <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 font-mono bg-emerald-500/10">
                    VISION-FIRST ENGINE
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {lastRefresh ? `LAST SYNC: ${formatDistanceToNow(lastRefresh)} ago` : 'INITIALIZING…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${running > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className="text-xs font-mono text-gray-300">{running} LIVE</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
                className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-2 font-mono text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                REFRESH
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ METRIC CARDS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'RUNNING', value: running, icon: Activity, color: 'emerald', sub: 'Live instances', glow: running > 0 },
            { label: 'PENDING', value: pending, icon: Clock, color: 'yellow', sub: 'Queue', glow: false },
            { label: 'ERRORS', value: errors, icon: XCircle, color: 'red', sub: 'Failed / Timeout', glow: errors > 0 },
            { label: 'BROWSER MIN', value: usage ? usage.browserMinutes.toLocaleString() : '—', icon: TrendingUp, color: 'cyan', sub: usage ? formatBytes(usage.proxyBytes) + ' proxy' : 'Loading…', glow: false },
          ].map(({ label, value, icon: Icon, color, sub, glow }) => {
            const colors = {
              emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', icon: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
              yellow:  { border: 'border-yellow-500/30',  bg: 'bg-yellow-500/5',  text: 'text-yellow-400',  icon: 'bg-yellow-500/10',  glow: 'shadow-yellow-500/20' },
              red:     { border: 'border-red-500/30',     bg: 'bg-red-500/5',     text: 'text-red-400',     icon: 'bg-red-500/10',     glow: 'shadow-red-500/20' },
              cyan:    { border: 'border-cyan-500/30',    bg: 'bg-cyan-500/5',    text: 'text-cyan-400',    icon: 'bg-cyan-500/10',    glow: 'shadow-cyan-500/20' },
            };
            const c = colors[color];
            return (
              <div key={label} className={`relative rounded-xl border ${c.border} ${c.bg} p-4 ${glow ? `shadow-lg ${c.glow}` : ''} overflow-hidden`}>
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10" style={{ background: `radial-gradient(circle, currentColor, transparent)` }} />
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                  {glow && <div className={`w-2 h-2 rounded-full ${color === 'emerald' ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />}
                </div>
                <div className={`text-2xl font-black ${c.text} font-mono`}>{value}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{label}</div>
                <div className="text-xs text-gray-600 mt-1">{sub}</div>
              </div>
            );
          })}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Sessions — styled like session cards from reference */}
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
                  <span className="text-sm font-mono">NO SESSIONS DETECTED</span>
                </div>
              )}
              {recentSessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors group">
                  {/* index chip */}
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-800 text-gray-600 text-xs font-mono flex-shrink-0">
                    {i + 1}
                  </div>
                  <StatusBadge status={s.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-300 truncate group-hover:text-white transition-colors">{s.id}</div>
                    <div className="text-xs text-gray-600 font-mono">
                      {s.region} · {s.startedAt ? formatDuration(s.startedAt, s.endedAt) : 'NOT STARTED'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-700 font-mono flex-shrink-0">
                    {formatDistanceToNow(new Date(s.createdAt))} ago
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-3">

            {/* Quick Launch */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 rounded-full bg-cyan-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">QUICK LAUNCH</span>
              </div>
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
                    {apiStatus === 'ok'      ? `OK · ${apiLatency}ms` :
                     apiStatus === 'error'   ? 'UNREACHABLE' :
                     apiStatus === 'testing' ? 'PINGING…' :
                     'NOT TESTED'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={testApi}
                  disabled={apiStatus === 'testing'}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs h-8 px-3 font-mono"
                >
                  TEST
                </Button>
              </div>
            </div>

            {/* Fleet Health */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-4 rounded-full bg-pink-400" />
                <span className="text-sm font-bold text-white font-mono tracking-wide">FLEET HEALTH</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'RUNNING',   count: running,   color: 'bg-emerald-400', glow: 'shadow-emerald-500/30' },
                  { label: 'PENDING',   count: pending,   color: 'bg-yellow-400',  glow: '' },
                  { label: 'COMPLETED', count: completed, color: 'bg-cyan-400',    glow: '' },
                  { label: 'ERRORS',    count: errors,    color: 'bg-red-400',     glow: errors > 0 ? 'shadow-red-500/30' : '' },
                ].map(({ label, count, color, glow }) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-gray-300">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color} transition-all duration-700 ${glow ? `shadow ${glow}` : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SYSTEM HEALTH BAR (bottom, inspired by reference) ═══ */}
        <div className="rounded-xl border border-emerald-500/20 bg-gray-900/80 px-5 py-3 flex items-center gap-4">
          <span className="text-xs font-black font-mono text-emerald-400 flex-shrink-0 tracking-wider">SYSTEM HEALTH</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow shadow-emerald-500/50 transition-all duration-1000"
              style={{ width: `${healthPct}%` }}
            />
          </div>
          {/* Waveform decoration */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  height: `${4 + Math.abs(Math.sin((tick + i) * 0.8)) * 12}px`,
                  opacity: 0.6 + Math.abs(Math.sin((tick + i) * 0.5)) * 0.4,
                }}
              />
            ))}
          </div>
          <span className="text-sm font-black font-mono text-emerald-400 flex-shrink-0">{healthPct}%</span>
          <span className="text-xs font-mono text-gray-600 flex-shrink-0">SYSTEM HEALTH</span>
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