import { memo, useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import RowScreenshotsDialog from '@/components/authorizedBulk/RowScreenshotsDialog';
import { AU_CASINO_TARGETS } from '@/lib/auCasino';

const colors = {
  queued: 'text-gray-400 bg-gray-800/60 border-gray-800',
  running: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  passed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  review: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  failed: 'text-red-300 bg-red-500/10 border-red-500/20',
};

function TaskPill({ row, target, task }) {
  const [open, setOpen] = useState(false);
  const status = task?.status || 'queued';
  const clickable = !!task?.sessionId;
  // RowScreenshotsDialog reads `row.sessionId` + `row.username` — pass a
  // synthesized "row" so the same dialog works without modification.
  const dialogRow = {
    sessionId: task?.sessionId,
    username: `${row.username} · ${target.label}`,
    status,
  };

  return (
    <>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => clickable && setOpen(true)}
        onKeyDown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(true))}
        className={`rounded-lg border px-3 py-2 flex-1 min-w-[200px] transition-colors ${
          colors[status] || colors.queued
        } ${clickable ? 'cursor-pointer hover:brightness-125' : ''}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>{target.label}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-90">
            {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            {status}
          </span>
        </div>
        {task?.outcome && <div className="text-[11px] mt-1 opacity-80 line-clamp-2">{task.outcome}</div>}
        <div className="flex items-center justify-between mt-1 gap-2">
          {task?.finalUrl && (
            <div className="text-[10px] font-mono opacity-60 truncate max-w-[180px]">{task.finalUrl}</div>
          )}
          {clickable && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
              <ImageIcon className="w-3 h-3" /> view
            </span>
          )}
        </div>
      </div>
      {clickable && <RowScreenshotsDialog row={dialogRow} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function DualTargetRowItem({ row, tasks }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center text-xs font-mono">
          {row.index + 1}
        </div>
        <div className="text-sm text-gray-200 truncate flex-1">{row.username}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {AU_CASINO_TARGETS.map((target) => (
          <TaskPill key={target.key} row={row} target={target} task={tasks?.[target.key]} />
        ))}
      </div>
    </div>
  );
}

export default memo(DualTargetRowItem);