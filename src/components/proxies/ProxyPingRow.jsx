/**
 * Single-row card for the Proxy Health dashboard. Shows live latency,
 * a colour-coded health pill (red >500ms), and a Rotate action that
 * disables the proxy and re-routes traffic to the next pool member.
 */
import { Loader2, Activity, AlertTriangle, RotateCw, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LATENCY_THRESHOLD_MS = 500;

function latencyColor(ping) {
  if (!ping) return 'text-gray-500';
  if (!ping.ok) return 'text-red-400';
  if (ping.latencyMs >= LATENCY_THRESHOLD_MS) return 'text-red-400';
  if (ping.latencyMs >= LATENCY_THRESHOLD_MS * 0.7) return 'text-yellow-300';
  return 'text-emerald-300';
}

function statusPill(ping, proxy) {
  if (!ping) {
    return { cls: 'bg-gray-800/60 border-gray-700 text-gray-400', label: proxy?.healthStatus || 'unknown', Icon: Activity };
  }
  if (!ping.ok) return { cls: 'bg-red-500/10 border-red-500/30 text-red-300', label: 'failed', Icon: XCircle };
  if (ping.latencyMs >= LATENCY_THRESHOLD_MS) return { cls: 'bg-red-500/10 border-red-500/30 text-red-300', label: 'slow', Icon: AlertTriangle };
  if (ping.latencyMs >= LATENCY_THRESHOLD_MS * 0.7) return { cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300', label: 'degraded', Icon: AlertTriangle };
  return { cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', label: 'healthy', Icon: CheckCircle2 };
}

export default function ProxyPingRow({ proxy, ping, isPinging, onRotate, isRotating }) {
  const { cls, label, Icon } = statusPill(ping, proxy);
  const exceedsThreshold = ping?.ok && ping.latencyMs >= LATENCY_THRESHOLD_MS;
  const rowAlert = exceedsThreshold || (ping && !ping.ok);

  return (
    <div className={`grid grid-cols-12 gap-3 items-center px-4 py-3 rounded-lg border transition-colors ${
      rowAlert ? 'border-red-500/30 bg-red-500/5' : 'border-gray-800 bg-gray-900'
    }`}>
      <div className="col-span-4 min-w-0">
        <div className="text-sm font-mono text-gray-200 truncate">{proxy.label || proxy.server}</div>
        <div className="text-[10px] text-gray-500 truncate">{proxy.server}{proxy.country ? ` · ${proxy.country}` : ''}</div>
      </div>

      <div className="col-span-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${cls}`}>
          <Icon className="w-3 h-3" /> {label}
        </span>
      </div>

      <div className="col-span-3 flex items-center gap-2">
        {isPinging ? (
          <span className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> pinging…</span>
        ) : ping?.ok ? (
          <>
            <span className={`text-lg font-bold font-mono ${latencyColor(ping)}`}>{ping.latencyMs}</span>
            <span className="text-[10px] text-gray-500">ms</span>
            {exceedsThreshold && <AlertTriangle className="w-3 h-3 text-red-400 ml-1" title="Above 500ms threshold" />}
          </>
        ) : ping ? (
          <span className="text-xs text-red-400 truncate" title={ping.error}>{ping.error || 'failed'}</span>
        ) : (
          <span className="text-xs text-gray-600">no reading</span>
        )}
      </div>

      <div className="col-span-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={isRotating}
          onClick={() => onRotate(proxy)}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8"
        >
          {isRotating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
          Rotate
        </Button>
      </div>
    </div>
  );
}