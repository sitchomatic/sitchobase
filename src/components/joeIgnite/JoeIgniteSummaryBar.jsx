const bucketDef = [
  { key: 'running',    label: 'RUNNING',    color: 'text-cyan-400' },
  { key: 'success',    label: 'SUCCESS',    color: 'text-emerald-400' },
  { key: 'perm_ban',   label: 'PERM BAN',   color: 'text-red-400' },
  { key: 'temp_lock',  label: 'TEMP LOCK',  color: 'text-orange-400' },
  { key: 'no_account', label: 'NO ACCOUNT', color: 'text-gray-400' },
  { key: 'error',      label: 'ERROR',      color: 'text-yellow-400' },
  { key: 'queued',     label: 'QUEUED',     color: 'text-gray-500' },
];

export default function JoeIgniteSummaryBar({ rows }) {
  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const total = rows.length;

  return (
    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
      {bucketDef.map((b) => (
        <div key={b.key} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
          <div className={`text-lg font-black font-mono ${b.color}`}>{counts[b.key] || 0}</div>
          <div className="text-[10px] text-gray-500 font-mono tracking-wider">{b.label}</div>
        </div>
      ))}
      <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 col-span-4 md:col-span-7 flex items-center gap-3">
        <div className="text-xs text-gray-400">Progress</div>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
            style={{ width: `${total ? Math.round(((total - (counts.queued || 0) - (counts.running || 0)) / total) * 100) : 0}%` }}
          />
        </div>
        <div className="text-xs text-gray-300 font-mono">
          {total - (counts.queued || 0) - (counts.running || 0)} / {total}
        </div>
      </div>
    </div>
  );
}