import { Shield, Globe, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

const sources = [
  {
    value: 'none',
    label: 'No Proxy',
    icon: Ban,
    blurb: 'Use Browserbase default IPs.',
  },
  {
    value: 'bb-au',
    label: 'Browserbase AU',
    icon: Globe,
    blurb: 'Built-in AU residential proxy — fresh IP per session, no setup.',
  },
  {
    value: 'pool',
    label: 'External Pool',
    icon: Shield,
    blurb: 'Rotate through your uploaded proxies round-robin.',
  },
];

export default function JoeIgniteProxySourceToggle({ value, onChange, disabled, poolCount }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {sources.map((s) => {
        const active = value === s.value;
        const Icon = s.icon;
        const poolEmpty = s.value === 'pool' && poolCount === 0;
        return (
          <button
            key={s.value}
            onClick={() => !disabled && onChange(s.value)}
            disabled={disabled}
            className={cn(
              'text-left rounded-xl border px-4 py-3 transition-all',
              active
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-gray-800 bg-gray-900 hover:border-gray-700',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', active ? 'text-emerald-400' : 'text-gray-500')} />
              <span className={cn('text-sm font-semibold', active ? 'text-emerald-300' : 'text-gray-200')}>
                {s.label}
              </span>
              {active && <span className="ml-auto text-[10px] font-mono text-emerald-400">SELECTED</span>}
            </div>
            <div className="text-xs text-gray-400">
              {s.blurb}
              {s.value === 'pool' && (
                <span className={cn('block mt-0.5', poolEmpty ? 'text-yellow-400' : 'text-emerald-400')}>
                  {poolCount} proxies in pool
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}