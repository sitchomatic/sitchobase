import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import RowScreenshotsDialog from '@/components/authorizedBulk/RowScreenshotsDialog';

const statusClass = {
  passed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  review: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/30',
  running: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  queued: 'bg-gray-800 text-gray-400 border-gray-700',
};

function AuthorizedBulkRunResultItem({ row }) {
  const [open, setOpen] = useState(false);
  const clickable = !!row.sessionId;

  return (
    <>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => clickable && setOpen(true)}
        onKeyDown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(true))}
        className={`px-4 py-3 flex items-start gap-3 transition-colors ${
          clickable ? 'cursor-pointer hover:bg-gray-800/40' : ''
        }`}
      >
        <div className="w-8 text-xs font-mono text-gray-600 pt-1">#{row.index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white truncate">{row.username}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase ${statusClass[row.status] || statusClass.queued}`}>{row.status || 'queued'}</span>
            {clickable && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                <ImageIcon className="w-3 h-3" /> screenshots
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">{row.outcome || 'No outcome saved'}</div>
          {row.finalUrl && <div className="text-xs font-mono text-gray-600 mt-1 truncate">{row.finalUrl}</div>}
          {row.sessionId && (
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
              <Link to={`/sessions/${row.sessionId}`} className="text-emerald-400 hover:text-emerald-300">Open session</Link>
              <Link to="/audit" className="text-cyan-400 hover:text-cyan-300">Audit log</Link>
            </div>
          )}
        </div>
        {row.sessionId && <div className="hidden md:block text-[11px] font-mono text-gray-600 truncate max-w-[180px]">{row.sessionId}</div>}
      </div>
      {clickable && <RowScreenshotsDialog row={row} open={open} onOpenChange={setOpen} />}
    </>
  );
}

export default memo(AuthorizedBulkRunResultItem);