export default function FailureBreakdownList({ title, items, emptyLabel }) {
  const max = Math.max(...(items || []).map((item) => item.count), 1);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="text-sm font-bold text-white mb-3">{title}</div>
      {!items?.length ? (
        <div className="text-sm text-gray-500 py-8 text-center">{emptyLabel}</div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between gap-3 text-xs mb-1">
                <span className="text-gray-300 truncate font-mono">{item.name}</span>
                <span className="text-gray-500">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-yellow-400" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}