import { CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';

/**
 * Small green/red/grey pill driven by a "status" string:
 *   'idle' | 'pinging' | 'ok' | 'error'
 */
export default function ProviderStatusPill({ status, error }) {
  const map = {
    idle:    { Icon: Circle,      cls: 'bg-gray-800 text-gray-500 border-gray-700',                  text: 'Not tested' },
    pinging: { Icon: Loader2,     cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',     text: 'Testing…',  spin: true },
    ok:      { Icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', text: 'Connected' },
    error:   { Icon: XCircle,     cls: 'bg-red-500/10 text-red-300 border-red-500/30',             text: 'Error' },
  };
  const v = map[status] || map.idle;
  const Icon = v.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${v.cls}`}
      title={error || ''}
    >
      <Icon className={`w-3 h-3 ${v.spin ? 'animate-spin' : ''}`} />
      {v.text}
    </span>
  );
}