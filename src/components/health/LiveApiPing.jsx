import { useCallback, useEffect, useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { getCircuitState, getLastRequestId } from '@/lib/bbClient';
import { useBrowserbaseSessions } from '@/lib/browserbaseData';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, Shield } from 'lucide-react';
import ApiErrorState from '@/components/shared/ApiErrorState';
import { formatDistanceToNow } from 'date-fns';

/**
 * Live Browserbase API ping with latency + circuit-breaker readout.
 * Embedded in /health; replaces the standalone /status page.
 */
export default function LiveApiPing() {
  const { isConfigured } = useCredentials();
  const [state, setState] = useState('idle');
  const [latency, setLatency] = useState(null);
  const [sessionsCount, setSessionsCount] = useState(null);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [circuit, setCircuit] = useState(() => getCircuitState());
  const sessionsQuery = useBrowserbaseSessions({ enabled: false });
  const refetch = sessionsQuery.refetch;

  const check = useCallback(async () => {
    if (!isConfigured) { setState('fail'); setError('Credentials not configured'); return; }
    setState('checking');
    setError(null);
    setRequestId(null);
    const start = Date.now();
    try {
      const result = await refetch();
      if (result.error) throw result.error;
      const sessions = Array.isArray(result.data) ? result.data : [];
      setLatency(Date.now() - start);
      setSessionsCount(sessions.length);
      setState('ok');
    } catch (e) {
      setError(e.message || String(e));
      setRequestId(e.requestId || getLastRequestId());
      setState('fail');
    } finally {
      setCheckedAt(new Date());
      setCircuit(getCircuitState());
    }
  }, [isConfigured, refetch]);

  useEffect(() => { check(); }, [check]);
  useEffect(() => {
    const t = setInterval(() => setCircuit(getCircuitState()), 2000);
    return () => clearInterval(t);
  }, []);

  const cfg = {
    ok:       { color: 'emerald', label: 'Operational', icon: CheckCircle },
    fail:     { color: 'red',     label: 'Degraded',    icon: AlertCircle },
    checking: { color: 'yellow',  label: 'Checking…',   icon: Loader2 },
    idle:     { color: 'gray',    label: 'Not checked', icon: Shield },
  }[state];
  const Icon = cfg.icon;
  const cls = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    red:     'border-red-500/30 bg-red-500/5 text-red-400',
    yellow:  'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    gray:    'border-gray-700 bg-gray-900 text-gray-500',
  }[cfg.color];

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-5 ${cls}`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${state === 'checking' ? 'animate-spin' : ''}`} />
          <div className="flex-1">
            <div className="text-lg font-bold">Live API ping · {cfg.label}</div>
            <div className="text-xs opacity-75 mt-0.5">
              {state === 'ok' && `${latency}ms · ${sessionsCount} sessions · circuit ${circuit.state}`}
              {state === 'fail' && (error || 'Unknown error')}
              {state === 'checking' && 'Pinging Browserbase…'}
              {checkedAt && state !== 'checking' && ` · checked ${formatDistanceToNow(checkedAt)} ago`}
            </div>
          </div>
          <Button onClick={check} disabled={state === 'checking'} size="sm"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-700 gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${state === 'checking' ? 'animate-spin' : ''}`} /> Recheck
          </Button>
        </div>
      </div>
      {state === 'fail' && error && (
        <ApiErrorState title="Live ping failed" error={error} requestId={requestId} onRetry={check} />
      )}
    </div>
  );
}