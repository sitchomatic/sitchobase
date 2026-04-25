const statusClass = {
  passed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  review: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/30',
  running: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  queued: 'bg-gray-800 text-gray-400 border-gray-700',
};

export default function AuthorizedBulkRunResults({ results = [] }) {
  if (!results.length) {
    return <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">No saved row results yet.</div>;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 text-sm font-semibold text-white">Saved Results</div>
      <div className="divide-y divide-gray-800/70">
        {results.map((row) => (
          <div key={`${row.index}-${row.username}`} className="px-4 py-3 flex items-start gap-3">
            <div className="w-8 text-xs font-mono text-gray-600 pt-1">#{row.index + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white truncate">{row.username}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase ${statusClass[row.status] || statusClass.queued}`}>{row.status || 'queued'}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{row.outcome || 'No outcome saved'}</div>
              {row.finalUrl && <div className="text-xs font-mono text-gray-600 mt-1 truncate">{row.finalUrl}</div>}
            </div>
            {row.sessionId && <div className="hidden md:block text-[11px] font-mono text-gray-600 truncate max-w-[180px]">{row.sessionId}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}