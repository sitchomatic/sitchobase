/**
 * Proxy Health dashboard — real-time latency + connectivity for the
 * configured proxy pool. Calls the `pingProxies` backend function on
 * mount and on a 30s interval, highlights any proxy >500ms in red,
 * and exposes a one-click Rotate action that disables the offender
 * (the existing pool rotation logic then routes traffic to the next
 * enabled member).
 *
 * Heavy persistence + quarantine logic stays in `proxyNetworkHeal` —
 * this page is observability-first.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, RefreshCw, Shield, Zap, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import EmptyState from '@/components/shared/EmptyState';
import { listAllPaginated } from '@/lib/paginated';
import { queryKeys, invalidateMany } from '@/lib/queryKeys';
import { auditLog } from '@/lib/auditLog';
import ProxyPingRow from '@/components/proxies/ProxyPingRow';

const LATENCY_THRESHOLD_MS = 500;
const POLL_INTERVAL_MS = 30_000;

export default function ProxyHealth() {
  const qc = useQueryClient();
  const { credentials, isConfigured } = useCredentials();
  const [pingMap, setPingMap] = useState({}); // proxyId → { ok, latencyMs, error }
  const [pingingIds, setPingingIds] = useState(new Set());
  const [lastPingedAt, setLastPingedAt] = useState(null);
  const alertedRef = useRef(new Set()); // toast dedup so we don't spam every 30s

  const { data: proxies = [], refetch: refetchProxies } = useQuery({
    queryKey: queryKeys.proxyPool,
    queryFn: () => listAllPaginated(base44.entities.ProxyPool, '-created_date'),
    initialData: [],
    enabled: isConfigured,
  });

  const enabledProxies = useMemo(() => proxies.filter((p) => p.enabled !== false), [proxies]);

  const pingMutation = useMutation({
    mutationFn: async (ids = null) => {
      const targetIds = ids || enabledProxies.map((p) => p.id);
      setPingingIds(new Set(targetIds));
      const res = await base44.functions.invoke('pingProxies', {
        projectId: credentials.projectId,
        proxyIds: targetIds,
        limit: targetIds.length || 25,
      });
      return res?.data;
    },
    onSuccess: (data) => {
      const next = { ...pingMap };
      for (const r of data?.results || []) next[r.id] = r;
      setPingMap(next);
      setLastPingedAt(data?.pingedAt || new Date().toISOString());

      // Threshold alert — toast once per (id, exceeded) transition.
      for (const r of data?.results || []) {
        const exceeded = r.ok && r.latencyMs >= LATENCY_THRESHOLD_MS;
        const key = `${r.id}:exceeded`;
        if (exceeded && !alertedRef.current.has(key)) {
          alertedRef.current.add(key);
          toast.error(`Proxy "${r.label}" is slow (${r.latencyMs}ms > ${LATENCY_THRESHOLD_MS}ms)`, { duration: 6000 });
        }
        if (!exceeded) alertedRef.current.delete(key);
      }
      setPingingIds(new Set());
    },
    onError: (error) => {
      toast.error(error?.message || 'Ping failed');
      setPingingIds(new Set());
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (proxy) => {
      // "Rotate" = disable the offender so subsequent pool selections skip it.
      // The existing proxy-pool round-robin picks the next enabled record.
      await base44.entities.ProxyPool.update(proxy.id, {
        enabled: false,
        healthStatus: 'quarantined',
        lastError: 'Manually rotated from health dashboard',
        lastHealthCheckAt: new Date().toISOString(),
      });
      return proxy;
    },
    onSuccess: (proxy) => {
      toast.success(`Rotated "${proxy.label || proxy.server}" out of pool`);
      auditLog({ action: 'PROXY_ROTATED', category: 'settings', targetId: proxy.id, details: { reason: 'health-dashboard' } });
      invalidateMany(qc, [queryKeys.proxyPool]);
      // Drop its stale reading so the row falls back to the new disabled state.
      setPingMap((prev) => {
        const next = { ...prev };
        delete next[proxy.id];
        return next;
      });
    },
    onError: (error) => toast.error(error?.message || 'Rotate failed'),
  });

  // Auto-ping on mount + every 30s while the page is open.
  useEffect(() => {
    if (!isConfigured || enabledProxies.length === 0) return;
    pingMutation.mutate(null);
    const interval = setInterval(() => pingMutation.mutate(null), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured, enabledProxies.length, credentials?.projectId]);

  if (!isConfigured) return <CredentialsGuard />;

  // Stats for the header tiles.
  const readings = Object.values(pingMap);
  const healthy = readings.filter((r) => r.ok && r.latencyMs < LATENCY_THRESHOLD_MS).length;
  const slow = readings.filter((r) => r.ok && r.latencyMs >= LATENCY_THRESHOLD_MS).length;
  const failed = readings.filter((r) => !r.ok).length;
  const avgLatency = readings.filter((r) => r.ok).length
    ? Math.round(readings.filter((r) => r.ok).reduce((s, r) => s + r.latencyMs, 0) / readings.filter((r) => r.ok).length)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-transparent px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
          <Activity className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-lg font-bold text-white">Proxy Health</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Live latency + connectivity · auto-pings every 30s · alerts on &gt;{LATENCY_THRESHOLD_MS}ms
          </p>
        </div>
        <Link to="/proxies">
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Pool
          </Button>
        </Link>
        <Button
          onClick={() => pingMutation.mutate(null)}
          disabled={pingMutation.isPending || enabledProxies.length === 0}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${pingMutation.isPending ? 'animate-spin' : ''}`} />
          Ping all
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Active" value={enabledProxies.length} icon={Shield} className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20" />
        <StatTile label="Healthy" value={healthy} icon={Zap} className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" />
        <StatTile label={`Slow >${LATENCY_THRESHOLD_MS}ms`} value={slow} icon={AlertTriangle} className="text-red-400 bg-red-500/10 border-red-500/20" />
        <StatTile label="Avg latency" value={avgLatency ? `${avgLatency}ms` : '—'} icon={Activity} className="text-gray-300 bg-gray-800/60 border-gray-800" />
      </div>

      {lastPingedAt && (
        <div className="text-[10px] text-gray-600 text-right -mt-2">
          Last pinged {new Date(lastPingedAt).toLocaleTimeString()} · {failed} failed
        </div>
      )}

      {enabledProxies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No active proxies"
          description="Enable proxies in the pool to see live health readings."
          action={<Link to="/proxies"><Button size="sm">Manage proxies</Button></Link>}
        />
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-2 space-y-1.5">
          {enabledProxies.map((proxy) => (
            <ProxyPingRow
              key={proxy.id}
              proxy={proxy}
              ping={pingMap[proxy.id]}
              isPinging={pingingIds.has(proxy.id)}
              onRotate={() => rotateMutation.mutate(proxy)}
              isRotating={rotateMutation.isPending && rotateMutation.variables?.id === proxy.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, className }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <Icon className="w-4 h-4 mb-2" />
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}