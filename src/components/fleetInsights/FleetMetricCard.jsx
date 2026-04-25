export default function FleetMetricCard({ label, value, sub, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.emerald}`}>
      <div className="text-xs uppercase tracking-widest text-gray-400 font-mono">{label}</div>
      <div className="mt-2 text-3xl font-black text-white font-mono">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}