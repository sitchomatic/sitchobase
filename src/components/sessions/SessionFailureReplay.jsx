import { AlertTriangle, Clock, TerminalSquare } from 'lucide-react';

export default function SessionFailureReplay({ session, logs }) {
  const recentLogs = Array.isArray(logs) ? logs.slice(-30).reverse() : [];
  const failed = session?.status === 'ERROR' || session?.status === 'TIMED_OUT';

  if (!failed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-600">
        <Clock className="w-8 h-8 mb-3 opacity-30" />
        <div className="text-sm">Failure replay becomes available when a session fails</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-200">Automatic Failure Replay</div>
            <div className="text-xs text-red-300/80 mt-1">Showing the final activity window captured from the session log timeline for instant triage.</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-800/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
          <TerminalSquare className="w-4 h-4 text-emerald-400" />
          <div className="text-xs font-semibold text-white">Last 30 Events Before Failure</div>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-3 space-y-2 font-mono text-xs">
          {recentLogs.length === 0 ? (
            <div className="text-gray-500">No logs available for replay</div>
          ) : recentLogs.map((log, index) => (
            <div key={index} className="rounded bg-gray-900/70 px-2 py-1.5 text-gray-300 break-all">
              {typeof log === 'string' ? log : JSON.stringify(log)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}