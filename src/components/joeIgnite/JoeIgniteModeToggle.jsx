import { Cloud, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const modes = [
  {
    value: 'browser',
    label: 'Browser-orchestrated',
    icon: Monitor,
    blurb: 'Real-time updates. Keep this tab open until batch finishes.',
  },
  {
    value: 'serverless',
    label: 'Serverless',
    icon: Cloud,
    blurb: 'Runs on the backend. Close tab anytime. Polls for updates.',
  },
];

export default function JoeIgniteModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {modes.map((m) => {
        const active = mode === m.value;
        const Icon = m.icon;
        return (
          <button
            key={m.value}
            onClick={() => !disabled && onChange(m.value)}
            disabled={disabled}
            className={cn(
              'text-left rounded-xl border px-4 py-3 transition-all',
              active
                ? 'border-orange-500/50 bg-orange-500/10'
                : 'border-gray-800 bg-gray-900 hover:border-gray-700',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', active ? 'text-orange-400' : 'text-gray-500')} />
              <span className={cn('text-sm font-semibold', active ? 'text-orange-300' : 'text-gray-200')}>
                {m.label}
              </span>
              {active && <span className="ml-auto text-[10px] font-mono text-orange-400">SELECTED</span>}
            </div>
            <div className="text-xs text-gray-400">{m.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}