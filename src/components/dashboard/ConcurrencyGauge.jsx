import { Activity } from 'lucide-react';

export default function ConcurrencyGauge({ active, max }) {
  const safeMax = Math.max(max || 1, 1);
  const pct = Math.min((active / safeMax) * 100, 100);
  const rotation = -90 + (pct / 100) * 180;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gray-900/80 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-white font-mono tracking-wide">CONCURRENCY GAUGE</span>
      </div>

      <div className="relative mx-auto w-48 h-24 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 mx-auto w-48 h-48 rounded-full border-[14px] border-gray-800" />
        <div
          className="absolute left-1/2 bottom-0 h-20 w-1.5 origin-bottom rounded-full bg-gradient-to-t from-emerald-500 to-cyan-400 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        <div className="absolute left-1/2 bottom-0 w-4 h-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow" />
      </div>

      <div className="mt-3 text-center">
        <div className="text-3xl font-black text-emerald-400 font-mono">{active}</div>
        <div className="text-xs text-gray-500 mt-1">active of {safeMax} target concurrency</div>
      </div>
    </div>
  );
}