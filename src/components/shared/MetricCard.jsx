import { cn } from '@/lib/utils';

export default function MetricCard({ label, value, sub, icon: Icon, accent = 'emerald', trend }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
    purple:  'text-purple-400 bg-purple-500/10',
    orange:  'text-orange-400 bg-orange-500/10',
    red:     'text-red-400 bg-red-500/10',
    yellow:  'text-yellow-400 bg-yellow-500/10',
  };
  const cls = colors[accent] || colors.emerald;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', cls)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
      {trend && (
        <div className={cn('text-xs font-medium', trend > 0 ? 'text-emerald-400' : 'text-red-400')}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last hour
        </div>
      )}
    </div>
  );
}