export default function FleetChartPanel({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 min-h-[280px]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-4 rounded-full bg-emerald-400" />
        <h2 className="text-sm font-bold text-white font-mono tracking-wide uppercase">{title}</h2>
      </div>
      <div className="h-56">{children}</div>
    </div>
  );
}