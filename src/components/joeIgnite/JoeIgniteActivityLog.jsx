import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Ban, XCircle, AlertCircle, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const eventStyle = {
  started:    { icon: Play,         color: 'text-cyan-400',    label: 'started' },
  attempt:    { icon: ArrowRight,   color: 'text-blue-300',    label: 'attempt' },
  success:    { icon: CheckCircle2, color: 'text-emerald-400', label: 'SUCCESS' },
  temp_lock:  { icon: Clock,        color: 'text-orange-400',  label: 'LOCKED' },
  perm_ban:   { icon: Ban,          color: 'text-red-400',     label: 'BANNED' },
  no_account: { icon: XCircle,      color: 'text-gray-300',    label: 'NO ACCOUNT' },
  error:      { icon: AlertCircle,  color: 'text-yellow-400',  label: 'ERROR' },
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false });
}

export default function JoeIgniteActivityLog({ events }) {
  const [autoscroll, setAutoscroll] = useState(true);
  const viewportRef = useRef(null);

  useEffect(() => {
    if (!autoscroll || !viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [events, autoscroll]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-sm font-semibold text-white">Activity Log</div>
          <div className="text-[11px] text-gray-500 font-mono">{events.length} events</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 text-[10px] ${autoscroll ? 'text-emerald-400' : 'text-gray-500'}`}
          onClick={() => setAutoscroll((v) => !v)}
        >
          Auto-scroll {autoscroll ? 'ON' : 'OFF'}
        </Button>
      </div>

      <div ref={viewportRef} className="h-80 overflow-y-auto">
        <div className="p-3 space-y-1">
          {events.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-10">
              No activity yet — events will stream here as the batch runs.
            </div>
          ) : (
            events.map((e, i) => {
              const cfg = eventStyle[e.type] || eventStyle.attempt;
              const Icon = cfg.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-[10px] text-gray-600 font-mono pt-0.5 w-16 flex-shrink-0">
                    {formatTime(e.at)}
                  </span>
                  <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <span className={`text-[10px] font-mono uppercase tracking-wider w-20 flex-shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-300 font-mono truncate flex-1">
                    {e.email}
                  </span>
                  {e.detail && (
                    <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">
                      {e.detail}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}