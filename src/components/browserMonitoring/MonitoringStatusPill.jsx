import { CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Status pill shown in every provider section header.
 * Drives off { status, error, lastCheckedAt } from the parent panel state.
 */
export default function MonitoringStatusPill({ status, error, lastCheckedAt }) {
  const map = {
    idle:    { Icon: Circle,      cls: 'bg-gray-800 text-gray-500 border-gray-700' },
    pinging: { Icon: Loader2,     cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30', spin: true },
    ok:      { Icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    error:   { Icon: XCircle,     cls: 'bg-red-500/10 text-red-300 border-red-500/30' },
  };
  const v = map[status] || map.idle;
  const Icon = v.Icon;
  const label = status === 'idle' ? 'Not tested'
    : status === 'pinging' ? 'Testing…'
    : status === 'ok' ? 'Connected'
    : 'Error';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${v.cls}`}
      title={error || (lastCheckedAt ? `Checked ${new Date(lastCheckedAt).toLocaleString()}` : '')}
    >
      <Icon className={`w-3 h-3 ${v.spin ? 'animate-spin' : ''}`} />
      {label}
      {lastCheckedAt && status !== 'pinging' && (
        <span className="opacity-60 ml-1">· {formatDistanceToNow(new Date(lastCheckedAt))} ago</span>
      )}
    </span>
  );
}