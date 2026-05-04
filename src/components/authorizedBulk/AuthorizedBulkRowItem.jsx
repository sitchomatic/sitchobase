import { memo, useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import RowScreenshotsDialog from '@/components/authorizedBulk/RowScreenshotsDialog';

const colors = {
  queued: 'text-gray-400 bg-gray-800/60 border-gray-800',
  running: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  passed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  review: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

function AuthorizedBulkRowItem({ row }) {
  const [open, setOpen] = useState(false);
  const clickable = !!row.sessionId;

  return (
    <>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => clickable && setOpen(true)}
        onKeyDown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(true))}
        className={`rounded-xl border border-gray-800 bg-gray-900 p-3 flex items-start gap-3 transition-colors ${
          clickable ? 'cursor-pointer hover:border-emerald-500/40 hover:bg-gray-900/80' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center text-xs font-mono">{row.index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-200 truncate">{row.username}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${colors[row.status] || colors.queued}`}>
              {row.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {row.status || 'queued'}
            </span>
            {clickable && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                <ImageIcon className="w-3 h-3" /> screenshots
              </span>
            )}
          </div>
          {row.outcome && <div className="text-xs text-gray-500 mt-1">{row.outcome}</div>}
          {(row.failureType || row.retryAttempt > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
              {row.failureType && <span className="px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300">{row.failureType}</span>}
              {row.retryAttempt > 0 && <span className="px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">retry {row.retryAttempt}</span>}
              {row.retryable === false && row.status === 'review' && <span className="px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">human review</span>}
            </div>
          )}
          {row.finalUrl && <div className="text-xs text-gray-600 truncate mt-0.5">{row.finalUrl}</div>}
        </div>
        {row.sessionId && <div className="hidden md:block text-[10px] font-mono text-gray-600 truncate max-w-[140px]">{row.sessionId}</div>}
      </div>
      {clickable && <RowScreenshotsDialog row={row} open={open} onOpenChange={setOpen} />}
    </>
  );
}

export default memo(AuthorizedBulkRowItem);