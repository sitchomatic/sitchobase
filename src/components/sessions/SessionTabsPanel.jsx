/**
 * SessionTabsPanel — multi-tab CDP target switcher for a live Browserbase session.
 * Uses Target.getTargets on the session's CDP connect URL to list all tabs,
 * and lets the user open any tab's frontend debugger URL.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Layers2, RefreshCw, ExternalLink, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SessionTabsPanel({ session }) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);
  const idRef = useRef(1);
  const callbacksRef = useRef({});

  const isRunning = session?.status === 'RUNNING' && !!session?.connectUrl;

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const loadTargets = useCallback(async () => {
    if (!isRunning) return;
    setLoading(true);
    cleanup();
    const ws = new WebSocket(session.connectUrl);
    wsRef.current = ws;

    const timeout = setTimeout(() => {
      toast.error('Timed out fetching tabs');
      setLoading(false);
      cleanup();
    }, 8000);

    ws.onopen = () => {
      const id = idRef.current++;
      callbacksRef.current[id] = (res, err) => {
        clearTimeout(timeout);
        if (err) {
          toast.error(`Failed to list tabs: ${err.message || 'CDP error'}`);
        } else {
          const pages = (res?.targetInfos || []).filter(t => t.type === 'page');
          setTargets(pages);
        }
        setLoading(false);
        cleanup();
      };
      ws.send(JSON.stringify({ id, method: 'Target.getTargets' }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const cb = callbacksRef.current[msg.id];
        if (cb) {
          cb(msg.result, msg.error);
          delete callbacksRef.current[msg.id];
        }
      } catch {}
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      toast.error('CDP connection error');
      setLoading(false);
      cleanup();
    };
  }, [isRunning, session?.connectUrl, cleanup]);

  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <WifiOff className="w-7 h-7 text-gray-600 mb-2" />
        <div className="text-sm text-gray-500">Session must be RUNNING to list tabs</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <Layers2 className="w-3.5 h-3.5 text-cyan-400" /> Open Tabs
          <span className="text-gray-600">({targets.length})</span>
        </div>
        <Button size="sm" onClick={loadTargets} disabled={loading}
          className="h-7 px-2.5 text-xs bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </Button>
      </div>

      {targets.length === 0 && !loading && (
        <div className="text-center py-6 text-xs text-gray-600">Click Refresh to load tabs via CDP</div>
      )}

      <div className="space-y-2">
        {targets.map(t => (
          <div key={t.targetId} className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 space-y-1">
            <div className="text-xs font-medium text-white truncate">{t.title || 'Untitled tab'}</div>
            <div className="text-[11px] text-gray-500 truncate">{t.url}</div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-mono text-gray-600">{t.targetId.slice(0, 10)}…</span>
              {session.debuggerUrl && (
                <a href={`${session.debuggerUrl}?targetId=${t.targetId}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"
                    className="h-6 px-2 text-[11px] border-gray-700 text-gray-300 hover:bg-gray-800 gap-1">
                    <ExternalLink className="w-3 h-3" /> Open
                  </Button>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}