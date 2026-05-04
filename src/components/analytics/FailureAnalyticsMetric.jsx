export default function FailureAnalyticsMetric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'danger' ? 'text-red-300' : tone === 'warn' ? 'text-yellow-300' : 'text-emerald-300';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-2 ${toneClass}`}>{value}</div>
    </div>
  );
}