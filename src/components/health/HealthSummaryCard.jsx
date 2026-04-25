export default function HealthSummaryCard({ label, value, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    gray: 'border-gray-800 bg-gray-900 text-gray-300',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.gray}`}>
      <div className="text-2xl font-black font-mono">{value}</div>
      <div className="text-xs uppercase tracking-wider mt-1 opacity-75">{label}</div>
    </div>
  );
}