import { memo } from 'react';
import { Loader2 } from 'lucide-react';

const colors = {
  queued: 'text-gray-400 bg-gray-800/60 border-gray-800',
  running: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  passed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  review: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

function AuthorizedBulkRowItem({ row }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center text-xs font-mono">{row.index + 1}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 truncate">{row.username}</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${colors[row.status] || colors.queued}`}>
            {row.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            {row.status || 'queued'}
          </span>
        </div>
        {row.outcome && <div className="text-xs text-gray-500 mt-1">{row.outcome}</div>}
        {row.finalUrl && <div className="text-xs text-gray-600 truncate mt-0.5">{row.finalUrl}</div>}
      </div>
      {row.sessionId && <div className="hidden md:block text-[10px] font-mono text-gray-600 truncate max-w-[140px]">{row.sessionId}</div>}
    </div>
  );
}

export default memo(AuthorizedBulkRowItem);