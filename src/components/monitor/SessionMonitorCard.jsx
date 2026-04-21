/**
 * SessionMonitorCard — live tile for a single RUNNING session.
 * Opens a CDP WebSocket, auto-captures screenshots, streams logs,
 * and shows real-time metrics — all without page refresh.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { bbClient, formatBytes, formatDuration, estimateCost, formatCost } from '@/lib/bbClient';
import { Button } from '@/components/ui/button';
import {
  Wifi, WifiOff, Camera, Loader2, Activity, Clock,
  Globe, DollarSign, Terminal, ZoomIn, Pause, Play
} from 'lucide-react';
import { toast } from 'sonner';

// ── CDP WebSocket hook ────────────────────────────────────────────────────────
function useCDP(connectUrl, enabled) {
  const wsRef = useRef(null);
  const cbRef = useRef({});
  const idRef = useRef(1);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const eventListenersRef = useRef([]);

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

  const onEvent = useCallback((method, handler) => {
    const entry = { method, handler };
    eventListenersRef.current.push(entry);
    return () => {
      eventListenersRef.current = eventListenersRef.current.filter(l => l !== entry);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !connectUrl) return;
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
        // Dispatch CDP events to listeners
        if (msg.method) {
          eventListenersRef.current
            .filter(l => l.method === msg.method)
            .forEach(l => l.handler(msg.params));
        }
      } catch {}
    };

    return () => { ws.close(); wsRef.current = null; setConnected(false); };
  }, [enabled, connectUrl]);

  return { connected, connecting, sendCmd, onEvent };
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function SessionMonitorCard({ session, onExpand }) {
  const isRunning = session.status === 'RUNNING';
  const [paused, setPaused] = useState(false);
  const { connected, connecting, sendCmd } = useCDP(session.connectUrl, isRunning);

  // Screenshot
  const [screenshot, setScreenshot] = useState(null);
  const [capturing, setCapturing] = useState(false);

  // Logs stream
  const [logs, setLogs] = useState([]);
  const logCountRef = useRef(0);

  // Live metrics (duration refreshed locally every second)
  const [tick, setTick] = useState(0);

  // Auto-screenshot every 4s when connected & not paused
  useEffect(() => {
    if (!connected || paused) return;
    const capture = async () => {
      setCapturing(true);
      try {
        const res = await sendCmd('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
        setScreenshot(`data:image/jpeg;base64,${res.data}`);
      } catch {}
      setCapturing(false);
    };
    capture(); // immediate first capture
    const t = setInterval(capture, 4000);
    return () => clearInterval(t);
  }, [connected, paused, sendCmd]);

  // Poll logs every 5s
  useEffect(() => {
    if (!isRunning || paused) return;
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
          }))].slice(-50));
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [session.id, isRunning, paused]);

  // Duration ticker
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const duration = session.startedAt ? formatDuration(session.startedAt, session.endedAt) : '—';
  const cost = formatCost(estimateCost(session.startedAt, session.endedAt));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          connecting ? 'bg-yellow-400 animate-pulse' :
          connected  ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
        }`} />
        <span className="text-xs font-mono text-gray-300 flex-1 truncate">{session.id}</span>
        <button onClick={() => setPaused(p => !p)}
          className="text-gray-500 hover:text-gray-200 transition-colors">
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => onExpand(session)}
          className="text-gray-500 hover:text-gray-200 transition-colors ml-1">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Screenshot area */}
      <div className="relative bg-gray-950 aspect-video flex items-center justify-center overflow-hidden">
        {screenshot ? (
          <img src={screenshot} alt="live" className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-700">
            {connecting || capturing
              ? <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
              : <Camera className="w-6 h-6" />}
            <span className="text-xs">
              {connected ? (paused ? 'Paused' : 'Capturing…') : (connecting ? 'Connecting CDP…' : 'CDP not connected')}
            </span>
          </div>
        )}
        {/* Overlay: capturing spinner */}
        {screenshot && capturing && (
          <div className="absolute top-1.5 right-1.5">
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          </div>
        )}
        {/* Paused badge */}
        {paused && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-xs text-white font-semibold bg-black/70 px-3 py-1 rounded-full">PAUSED</span>
          </div>
        )}
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-4 divide-x divide-gray-800 border-t border-gray-800">
        {[
          { icon: Clock, label: 'Duration', value: duration },
          { icon: DollarSign, label: 'Est. Cost', value: cost },
          { icon: Globe, label: 'Proxy', value: formatBytes(session.proxyBytes) },
          { icon: Activity, label: 'Region', value: session.region || '—' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center py-1.5 px-1">
            <Icon className="w-3 h-3 text-gray-600 mb-0.5" />
            <span className="text-xs font-mono text-gray-200 leading-none">{value}</span>
            <span className="text-xs text-gray-600 leading-none mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Live log tail */}
      <div className="flex-1 overflow-hidden bg-gray-950 border-t border-gray-800" style={{ maxHeight: 90 }}>
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-800">
          <Terminal className="w-3 h-3 text-gray-600" />
          <span className="text-xs text-gray-600 font-mono">LIVE LOG</span>
          {!paused && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-auto" />}
        </div>
        <div className="overflow-y-auto h-full px-2 py-1 space-y-0.5" style={{ maxHeight: 64 }}>
          {logs.length === 0 ? (
            <div className="text-xs text-gray-700 font-mono">Waiting for logs…</div>
          ) : (
            [...logs].reverse().map(l => (
              <div key={l.id} className="text-xs font-mono text-gray-500 truncate leading-relaxed">
                <span className="text-gray-700 mr-1">{new Date(l.ts).toLocaleTimeString()}</span>
                {l.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}