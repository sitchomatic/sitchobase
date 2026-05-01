import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { appendFromInvoke } from '@/lib/monitoringLog';

/**
 * Reusable hook for the per-provider Connection Test / Status Check.
 *
 * Advanced detection:
 *   - measures wall-clock latency on the client (covers backend + upstream)
 *   - surfaces upstream HTTP status, error_kind, and human hint from `_log`
 *   - records every probe into the shared monitoring log buffer
 */
export default function useProviderStatus(provider, extraPayload = {}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const ping = useCallback(async () => {
    setStatus('pinging');
    setError('');
    const t0 = Date.now();
    const res = await base44.functions.invoke('liveLook', { provider, op: 'ping', ...extraPayload });
    const clientLatency = Date.now() - t0;
    const meta = res?.data?._log || {};
    appendFromInvoke(res, { provider, op: 'ping' });

    setLastCheckedAt(Date.now());
    setDiagnostics({
      clientLatencyMs: clientLatency,
      backendDurationMs: meta.duration_ms ?? null,
      upstreamStatus: meta.upstream_status ?? null,
      requestId: meta.request_id ?? null,
      errorKind: meta.error_kind ?? null,
      hint: meta.hint ?? null,
    });

    if (res.data?.ok) {
      setStatus('ok');
      setData(res.data.data || null);
    } else {
      setStatus('error');
      setError(res.data?.error || 'Ping failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return { status, error, data, diagnostics, lastCheckedAt, ping };
}