/**
 * SessionExpandModal — full-screen live view of a single session,
 * with auto-refreshing CDP screenshot and scrollable log stream.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { bbClient, formatBytes, formatDuration, estimateCost, formatCost } from '@/lib/bbClient';
import { Button } from '@/components/ui/button';
import { X, Camera, Loader2, Clock, DollarSign, Globe, Activity, Wifi, WifiOff } from 'lucide-react';

function useCDP(connectUrl) {
  const wsRef = useRef(null);
  const cbRef = useRef({});
  const idRef = useRef(1);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const sendCmd = useCallback((method, params = {}) =>
    new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected')); return;
      }
      const id = idRef.current++;
      cbRef.current[id] = { resolve, reject };
      wsRef.current.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (cbRef.current[id]) { delete cbRef.current[id]; reject(new Error('Timeout')); }
      }, 8000);
    }), []);

  const connect = useCallback(() => {
    if (!connectUrl) return;
    setConnecting(true);
    const ws = new WebSocket(connectUrl);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setConnecting(false); };
    ws.onclose = () => { setConnected(false); setConnecting(false); };
    ws.onerror = () => { setConnected(false); setConnecting(false); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.id && cbRef.current[msg.id]) {
          if (msg.error) cbRef.current[msg.id].reject(new Error(msg.error.message));
          else cbRef.current[msg.id].resolve(msg.result);
          delete cbRef.current[msg.id];
        }
      } catch {}
    };
  }, [connectUrl]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  return { connected, connecting, sendCmd };
}

export default function SessionExpandModal({ session, onClose }) {
  const { connected, connecting, sendCmd } = useCDP(session.connectUrl);
  const [screenshot, setScreenshot] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [tick, setTick] = useState(0);
  const logCountRef = useRef(0);
  const logEndRef = useRef(null);

  // Auto-screenshot every 2s
  useEffect(() => {
    if (!connected) return;
    const capture = async () => {
      setCapturing(true);
      try {
        const res = await sendCmd('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
        setScreenshot(`data:image/jpeg;base64,${res.data}`);
      } catch {}
      setCapturing(false);
    };
    capture();
    const t = setInterval(capture, 2000);
    return () => clearInterval(t);
  }, [connected, sendCmd]);

  // Poll logs every 3s
  useEffect(() => {
    if (session.status !== 'RUNNING') return;
    const poll = async () => {
      try {
        const data = await bbClient.getSessionLogs(session.id);
        const all = Array.isArray(data) ? data : [];
        const fresh = all.slice(logCountRef.current);
        logCountRef.current = all.length;
        if (fresh.length) {
          setLogs(prev => [...prev, ...fresh.map(l => ({
            id: `${Date.now()}-${Math.random()}`,
            text: typeof l === 'string' ? l : JSON.stringify(l),
            ts: new Date().toISOString(),
          }))].slice(-200));
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [session.id, session.status]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Duration ticker
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-sm font-mono text-gray-300 flex-1 truncate">{session.id}</span>
        <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
          <span><Clock className="inline w-3 h-3 mr-1" />{session.startedAt ? formatDuration(session.startedAt, session.endedAt) : '—'}</span>
          <span><DollarSign className="inline w-3 h-3 mr-1" />{formatCost(estimateCost(session.startedAt, session.endedAt))}</span>
          <span><Globe className="inline w-3 h-3 mr-1" />{formatBytes(session.proxyBytes)}</span>
          <span><Activity className="inline w-3 h-3 mr-1" />{session.region}</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content: screenshot + logs side by side */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Screenshot */}
        <div className="flex-1 bg-gray-950 flex items-center justify-center relative">
          {screenshot ? (
            <img src={screenshot} alt="live screenshot"
              className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-700">
              {connecting || capturing
                ? <Loader2 className="w-10 h-10 animate-spin text-gray-600" />
                : <Camera className="w-10 h-10" />}
              <span className="text-sm">
                {connected ? 'Capturing…' : connecting ? 'Connecting to CDP…' : 'Waiting for CDP connection'}
              </span>
            </div>
          )}
          {/* Status overlays */}
          {screenshot && capturing && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
              <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
              <span className="text-xs text-emerald-400 font-mono">LIVE</span>
            </div>
          )}
          {screenshot && !capturing && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">STREAMING</span>
            </div>
          )}
        </div>

        {/* Log panel */}
        <div className="w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-gray-400">LIVE LOG STREAM</span>
            <span className="ml-auto text-xs text-gray-700">{logs.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-700 py-4 text-center">Waiting for logs…</div>
            ) : (
              logs.map(l => (
                <div key={l.id} className="text-gray-400 leading-relaxed break-all">
                  <span className="text-gray-700 mr-1.5">{new Date(l.ts).toLocaleTimeString()}</span>
                  {l.text}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}