import { useEffect, useState, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient, getCircuitState } from '@/lib/bbClient';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, Home, Shield, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Public-ish health/status page. Pings bbProxy → Browserbase and reports
 * end-to-end latency, auth mode, circuit state, and last-checked time.
 */
export default function Status() {
  const { isConfigured } = useCredentials();
  const [state, setState] = useState('idle'); // idle | checking | ok | fail
  const [latency, setLatency] = useState(null);
  const [sessionsCount, setSessionsCount] = useState(null);
  const [error, setError] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [circuit, setCircuit] = useState(() => getCircuitState());

  const check = useCallback(async () => {
    if (!isConfigured) { setState('fail'); setError('Credentials not configured'); return; }
    setState('checking');
    setError(null);
    const start = Date.now();
    try {
      const sessions = await bbClient.listSessions();
      setLatency(Date.now() - start);
      setSessionsCount(Array.isArray(sessions) ? sessions.length : 0);
      setState('ok');
    } catch (e) {
      setError(e.message || String(e));
      setState('fail');
    } finally {
      setCheckedAt(new Date());
      setCircuit(getCircuitState());
    }
  }, [isConfigured]);

  useEffect(() => { check(); }, [check]);
  useEffect(() => {
    const t = setInterval(() => setCircuit(getCircuitState()), 2000);
    return () => clearInterval(t);
  }, []);

  const statusConfig = {
    ok:       { color: 'emerald', label: 'Operational',  icon: CheckCircle },
    fail:     { color: 'red',     label: 'Degraded',     icon: AlertCircle },
    checking: { color: 'yellow',  label: 'Checking…',    icon: Loader2 },
    idle:     { color: 'gray',    label: 'Not checked',  icon: Shield },
  }[state];
  const c = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    red:     'border-red-500/30 bg-red-500/5 text-red-400',
    yellow:  'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    gray:    'border-gray-700 bg-gray-900 text-gray-500',
  }[statusConfig.color];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">System Status</h1>
              <p className="text-xs text-gray-500 mt-0.5">Live health of the BB Command Center</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-2">
              <Home className="w-3.5 h-3.5" /> Dashboard
            </Button>
          </Link>
        </div>

        {/* Overall */}
        <div className={`rounded-xl border p-5 ${c}`}>
          <div className="flex items-start gap-3">
            <statusConfig.icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${state === 'checking' ? 'animate-spin' : ''}`} />
            <div className="flex-1">
              <div className="text-lg font-bold">{statusConfig.label}</div>
              <div className="text-xs opacity-75 mt-0.5">
                {checkedAt ? `Last checked ${formatDistanceToNow(checkedAt)} ago` : 'Running initial check…'}
              </div>
            </div>
            <Button onClick={check} disabled={state === 'checking'} size="sm"
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${state === 'checking' ? 'animate-spin' : ''}`} /> Recheck
            </Button>
          </div>
        </div>

        {/* Component status */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold text-white">Components</div>
          <div className="divide-y divide-gray-800/60">
            <Row label="Credentials configured" ok={isConfigured}
              detail={isConfigured ? 'Project ID present' : 'Go to Settings to configure'} />
            <Row label="Browserbase API" ok={state === 'ok'}
              detail={state === 'ok' ? `${latency}ms · ${sessionsCount} sessions` : error || '—'} />
            <Row label="Circuit breaker" ok={circuit.state === 'closed'}
              detail={`State: ${circuit.state} · ${circuit.failures} recent failures`} />
          </div>
        </div>

        {/* Error detail */}
        {state === 'fail' && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="text-xs font-bold text-red-400 uppercase mb-1">Error detail</div>
            <div className="text-xs font-mono text-red-300 break-words">{error}</div>
            <div className="text-[11px] text-gray-500 mt-2">
              Common causes: invalid API key, Project ID mismatch, Browserbase outage, or bbProxy auth failure.{' '}
              <Link to="/settings" className="text-emerald-400 hover:text-emerald-300">Check settings →</Link>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-gray-600">
          This page auto-checks once on load. Use the recheck button for on-demand probes.
        </div>
      </div>
    </div>
  );
}

function Row({ label, ok, detail }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {ok
        ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200">{label}</div>
        <div className="text-xs text-gray-500 truncate">{detail}</div>
      </div>
    </div>
  );
}