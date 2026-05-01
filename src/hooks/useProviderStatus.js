import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Reusable hook for the per-provider Connection Test / Status Check.
 * Wraps a `liveLook` ping and exposes { status, error, data, lastCheckedAt, ping }.
 */
export default function useProviderStatus(provider, extraPayload = {}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const ping = useCallback(async () => {
    setStatus('pinging');
    setError('');
    const res = await base44.functions.invoke('liveLook', {
      provider,
      op: 'ping',
      ...extraPayload,
    });
    setLastCheckedAt(Date.now());
    if (res.data?.ok) {
      setStatus('ok');
      setData(res.data.data || null);
    } else {
      setStatus('error');
      setError(res.data?.error || 'Ping failed');
    }
    // We deliberately depend only on `provider` — `extraPayload` is a fresh
    // object literal per render and would defeat memoisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return { status, error, data, lastCheckedAt, ping };
}