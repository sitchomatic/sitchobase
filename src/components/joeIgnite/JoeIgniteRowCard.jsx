import { Loader2, CheckCircle2, XCircle, AlertCircle, Ban, Clock, Circle } from 'lucide-react';

const statusConfig = {
  queued:     { icon: Circle,       color: 'text-gray-500',    bg: 'bg-gray-800/60 border-gray-700' },
  running:    { icon: Loader2,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/30', spin: true },
  success:    { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  perm_ban:   { icon: Ban,          color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
  temp_lock:  { icon: Clock,        color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30' },
  no_account: { icon: XCircle,      color: 'text-gray-400',    bg: 'bg-gray-500/10 border-gray-500/30' },
  error:      { icon: AlertCircle,  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' },
};

export default function JoeIgniteRowCard({ row }) {
  const cfg = statusConfig[row.status] || statusConfig.queued;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${cfg.bg}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-gray-200 truncate">{row.email}</div>
        <div className="text-[11px] text-gray-500 flex items-center gap-2">
          <span className="uppercase tracking-wide">{row.status}</span>
          {row.attempts ? <span>· try {row.attempts}</span> : null}
          {row.joeOutcome ? <span>· joe: <span className="text-gray-300">{row.joeOutcome}</span></span> : null}
          {row.ignitionOutcome ? <span>· ign: <span className="text-gray-300">{row.ignitionOutcome}</span></span> : null}
        </div>
      </div>
      {row.sessionId && (
        <div className="text-[10px] text-gray-600 font-mono truncate max-w-[120px]">{row.sessionId.slice(0, 8)}…</div>
      )}
    </div>
  );
}