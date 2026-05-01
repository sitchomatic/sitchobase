import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Modal showing the live + historical screenshot timeline for one bulk-QA
 * row. Frames are produced by the 500ms screenshot poller in
 * `lib/authorizedBulkRunner.js` and stored on AutomationEvidence.
 *
 * While the row is still running we refetch every 1.5s so new frames stream
 * in without a manual refresh.
 */
export default function RowScreenshotsDialog({ row, open, onOpenChange }) {
  const sessionId = row?.sessionId;
  const isLive = row?.status === 'running' || row?.status === 'queued';
  const [selected, setSelected] = useState(null);

  const { data: evidence, isFetching, refetch } = useQuery({
    queryKey: ['rowScreenshots', sessionId],
    queryFn: async () => {
      const list = await base44.entities.AutomationEvidence.filter({ browserbaseSessionId: sessionId });
      return list?.[0] || null;
    },
    enabled: open && !!sessionId,
    refetchInterval: open && isLive ? 1_500 : false,
    initialData: null,
  });

  const frames = evidence?.screenshotLogs || [];

  useEffect(() => {
    if (!selected && frames.length) setSelected(frames[frames.length - 1]);
  }, [frames, selected]);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Screenshots — <span className="font-mono text-gray-300 truncate">{row?.username}</span>
            {isLive && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">live · 500ms</span>}
            <Button size="sm" variant="ghost" onClick={() => refetch()} className="ml-auto h-7 px-2 text-gray-400 hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {!sessionId && (
          <div className="py-12 text-center text-sm text-gray-500">No session has been launched for this row yet.</div>
        )}

        {sessionId && frames.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-2 text-gray-500">
            {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
            <span className="text-sm">{isFetching ? 'Loading…' : 'No frames captured yet'}</span>
          </div>
        )}

        {frames.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 max-h-[70vh]">
            <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden flex items-center justify-center min-h-[300px]">
              {selected?.url ? (
                <img src={selected.url} alt={selected.name || 'frame'} className="max-h-[68vh] w-auto object-contain" />
              ) : (
                <ImageIcon className="w-10 h-10 text-gray-700" />
              )}
            </div>
            <div className="overflow-y-auto pr-1 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 px-1">{frames.length} frame{frames.length !== 1 ? 's' : ''}</div>
              {frames.slice().reverse().map((frame, idx) => {
                const isSel = selected?.url === frame.url && selected?.timestamp === frame.timestamp;
                return (
                  <button
                    key={`${frame.timestamp}-${idx}`}
                    type="button"
                    onClick={() => setSelected(frame)}
                    className={`w-full flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                      isSel ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <img src={frame.url} alt="" className="w-16 h-12 object-cover rounded bg-gray-800 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-300 truncate">{frame.name || 'frame'}</div>
                      <div className="text-[10px] text-gray-600 font-mono">{new Date(frame.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </button>
                );
              })}
              {evidence?.recordingUrl && (
                <a href={evidence.recordingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mt-2 py-1.5 border border-emerald-500/20 rounded-lg">
                  <ExternalLink className="w-3 h-3" /> Open recording
                </a>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}