import StatusBadge from '@/components/shared/StatusBadge';
import { formatBytes, formatDuration, estimateCost, formatCost } from '@/lib/bbClient';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, Square, Eye } from 'lucide-react';

export default function SessionCardGrid({ sessions, selectedId, checkedIds, onToggleCheck, onOpen }) {
  if (sessions.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
      {sessions.map(s => (
        <div key={s.id}
          onClick={() => onOpen(s.id)}
          className={`rounded-xl border ${selectedId === s.id ? 'border-emerald-500/40 bg-gray-800' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'}
            ${checkedIds.has(s.id) ? 'ring-1 ring-emerald-500/30' : ''} p-3 cursor-pointer transition-all flex flex-col gap-2`}>
          <div className="flex items-center justify-between">
            <StatusBadge status={s.status} />
            <button onClick={e => { e.stopPropagation(); onToggleCheck(s.id); }}
              className="text-gray-500 hover:text-emerald-400">
              {checkedIds.has(s.id)
                ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                : <Square className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[11px] font-mono text-gray-300 truncate">{s.id}</div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 flex-wrap">
            <span>{s.region}</span>
            <span>·</span>
            <span>{formatBytes(s.proxyBytes)}</span>
            {s.keepAlive && <span className="text-emerald-500">· KA</span>}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-800/70">
            <span>{s.startedAt ? formatDuration(s.startedAt, s.endedAt) : '—'}</span>
            <span className="text-yellow-500/80 font-mono">{formatCost(estimateCost(s.startedAt, s.endedAt))}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-600">
            <span>{formatDistanceToNow(new Date(s.createdAt))} ago</span>
            <Eye className="w-3 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}