import { Activity, AlertTriangle } from 'lucide-react';

export default function ConcurrencyGauge({ active, max }) {
  const safeMax = Math.max(max || 1, 1);
  const pct = Math.min((active / safeMax) * 100, 100);
  const rotation = -90 + (pct / 100) * 180;

  const level = pct >= 90 ? 'overload' : pct >= 70 ? 'warning' : 'ok';
  const needleColor = level === 'overload'
    ? 'from-red-500 to-orange-400 shadow-[0_0_16px_rgba(239,68,68,0.55)]'
    : level === 'warning'
      ? 'from-yellow-500 to-orange-400 shadow-[0_0_16px_rgba(234,179,8,0.45)]'
      : 'from-emerald-500 to-cyan-400 shadow-[0_0_16px_rgba(16,185,129,0.45)]';
  const borderColor = level === 'overload' ? 'border-red-500/40' : level === 'warning' ? 'border-yellow-500/30' : 'border-emerald-500/20';
  const countColor = level === 'overload' ? 'text-red-400' : level === 'warning' ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className={`rounded-xl border ${borderColor} bg-gray-900/80 p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white font-mono tracking-wide">CONCURRENCY GAUGE</span>
        </div>
        {level !== 'ok' && (
          <div className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border
            ${level === 'overload' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
            <AlertTriangle className="w-3 h-3" />
            {level === 'overload' ? 'OVERLOAD' : 'NEAR LIMIT'}
          </div>
        )}
      </div>

      <div className="relative mx-auto w-48 h-24 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 mx-auto w-48 h-48 rounded-full border-[14px] border-gray-800" />
        <div
          className={`absolute left-1/2 bottom-0 h-20 w-1.5 origin-bottom rounded-full bg-gradient-to-t ${needleColor}`}
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        <div className="absolute left-1/2 bottom-0 w-4 h-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow" />
      </div>

      <div className="mt-3 text-center">
        <div className={`text-3xl font-black font-mono ${countColor}`}>{active}</div>
        <div className="text-xs text-gray-500 mt-1">active of {safeMax} target concurrency · {Math.round(pct)}%</div>
        {level === 'overload' && <div className="text-[11px] text-red-400 mt-2">⚠ Approaching plan limit — consider scaling down or queuing</div>}
      </div>
    </div>
  );
}