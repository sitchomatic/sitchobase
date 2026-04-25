import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles = {
  ok: {
    icon: CheckCircle,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    label: 'OK',
  },
  warn: {
    icon: AlertTriangle,
    className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    label: 'Needs attention',
  },
  pending: {
    icon: Clock,
    className: 'border-gray-700 bg-gray-800/70 text-gray-400',
    label: 'Checking',
  },
};

export default function HealthChecklistItem({ title, description, status = 'pending', action }) {
  const config = statusStyles[status] || statusStyles.pending;
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 flex items-start gap-3">
      <div className={cn('h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0', config.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0', config.className)}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}