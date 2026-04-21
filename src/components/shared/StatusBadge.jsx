import { cn } from '@/lib/utils';

const statusConfig = {
  RUNNING:   { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' },
  PENDING:   { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400' },
  ERROR:     { color: 'bg-red-500/20 text-red-400 border-red-500/30',             dot: 'bg-red-400' },
  TIMED_OUT: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',   dot: 'bg-orange-400' },
  COMPLETED: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',          dot: 'bg-gray-400' },
};

export default function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.PENDING;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {status}
    </span>
  );
}