import { memo, useState } from 'react';
import { Image as ImageIcon, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import RowScreenshotsDialog from '@/components/authorizedBulk/RowScreenshotsDialog';
import { AU_CASINO_TARGETS } from '@/lib/auCasino';
import { useCredentials } from '@/lib/useCredentials';
import { auditLog } from '@/lib/auditLog';
import { getOutcomeUi } from '@/lib/auCasinoOutcomeUi';

function TaskPill({ row, target, task }) {
  const { credentials } = useCredentials();
  const [open, setOpen] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const status = task?.status || 'queued';
  const meta = getOutcomeUi(status);
  const StatusIcon = meta.icon;
  const clickable = !!task?.sessionId;
  // Live Look only makes sense while the session is still up. Once a task
  // hits a terminal status the session is released and Browserbase returns
  // 404 on /debug — hide the button at that point.
  const liveAvailable = !!task?.sessionId && (status === 'running' || status === 'queued');

  const dialogRow = {
    sessionId: task?.sessionId,
    username: `${row.username} · ${target.label}`,
    status,
  };

  const openLiveLook = async (e) => {
    e.stopPropagation();
    if (!task?.sessionId || liveBusy) return;
    setLiveBusy(true);
    const res = await base44.functions.invoke('liveLook', {
      provider: 'browserbase',
      op: 'live',
      sessionId: task.sessionId,
      apiKeyOverride: credentials.apiKey || undefined,
    });
    setLiveBusy(false);
    const liveUrl = res?.data?.data?.debuggerFullscreenUrl || res?.data?.data?.debuggerUrl;
    if (res?.data?.ok && liveUrl) {
      window.open(liveUrl, '_blank', 'noopener,noreferrer');
      auditLog({
        action: 'AU_CASINO_DUAL_LIVE_LOOK_OPENED',
        category: 'session',
        targetId: task.sessionId,
        details: { rowIndex: row.index, target: target.key, username: row.username },
      });
    } else {
      toast.error(res?.data?.error || 'Live Look not available — session may have ended');
    }
  };

  return (
    <>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => clickable && setOpen(true)}
        onKeyDown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(true))}
        className={`rounded-lg border px-3 py-2 flex-1 min-w-[200px] transition-colors ${meta.pill} ${
          clickable ? 'cursor-pointer hover:brightness-125' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>{target.label}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-90">
            <StatusIcon className={`w-3 h-3 ${meta.spin ? 'animate-spin' : ''}`} />
            {meta.label}
          </span>
        </div>
        {task?.outcome && <div className="text-[11px] mt-1 opacity-80 line-clamp-2">{task.outcome}</div>}
        <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
          {task?.finalUrl && (
            <div className="text-[10px] font-mono opacity-60 truncate max-w-[180px]">{task.finalUrl}</div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {liveAvailable && (
              <button
                type="button"
                onClick={openLiveLook}
                disabled={liveBusy}
                title="Open the live Browserbase debugger in a new tab to manually intervene"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
              >
                {liveBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                Live Look
              </button>
            )}
            {clickable && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                <ImageIcon className="w-3 h-3" /> view
              </span>
            )}
          </div>
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