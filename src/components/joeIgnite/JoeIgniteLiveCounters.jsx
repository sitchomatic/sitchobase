import { CheckCircle2, Clock, Ban, XCircle, AlertCircle, Loader2, Circle } from 'lucide-react';

const buckets = [
  { key: 'success',    label: 'Success',    icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  { key: 'temp_lock',  label: 'Locked',     icon: Clock,        color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30' },
  { key: 'perm_ban',   label: 'Banned',     icon: Ban,          color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
  { key: 'no_account', label: 'No Account', icon: XCircle,      color: 'text-gray-300',    bg: 'bg-gray-500/10 border-gray-600/40' },
  { key: 'running',    label: 'Running',    icon: Loader2,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/30', spin: true },
  { key: 'queued',     label: 'Queued',     icon: Circle,       color: 'text-gray-500',    bg: 'bg-gray-800/60 border-gray-700' },
  { key: 'error',      label: 'Error',      icon: AlertCircle,  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' },
];

export default function JoeIgniteLiveCounters({ rows }) {
  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const total = rows.length;
  const done = total - (counts.queued || 0) - (counts.running || 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Live Progress</div>
        <div className="text-xs text-gray-400 font-mono">{done} / {total} complete · {pct}%</div>
      </div>

      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {buckets.slice(0, 4).map((b) => {
          const n = counts[b.key] || 0;
          const Icon = b.icon;
          return (
            <div key={b.key} className={`rounded-lg border px-3 py-3 ${b.bg}`}>
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${b.color}`} />
                <div className={`text-2xl font-black font-mono ${b.color}`}>{n}</div>
              </div>
              <div className="text-[10px] text-gray-400 font-mono tracking-wider uppercase mt-1">{b.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {buckets.slice(4).map((b) => {
          const n = counts[b.key] || 0;
          const Icon = b.icon;
          return (
            <div key={b.key} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${b.bg}`}>
              <Icon className={`w-3.5 h-3.5 ${b.color} ${b.spin && n > 0 ? 'animate-spin' : ''}`} />
              <div className="flex-1">
                <div className={`text-sm font-bold font-mono ${b.color}`}>{n}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{b.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}