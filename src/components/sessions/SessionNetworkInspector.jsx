import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2, Search, Download, Globe } from 'lucide-react';
import { toast } from 'sonner';

function useNetworkSocket(session) {
  const wsRef = useRef(null);
  const callbacksRef = useRef({});
  const commandIdRef = useRef(1);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      reject(new Error('CDP not connected'));
      return;
    }
    const id = commandIdRef.current++;
    callbacksRef.current[id] = { resolve, reject };
    wsRef.current.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (callbacksRef.current[id]) {
        delete callbacksRef.current[id];
        reject(new Error('CDP timeout'));
      }
    }, 8000);
  });

  const connect = () => {
    if (!session?.connectUrl) {
      toast.error('No CDP URL available');
      return;
    }
    wsRef.current?.close();
    const ws = new WebSocket(session.connectUrl);
    wsRef.current = ws;
    setConnecting(true);

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
    };
    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
    };
    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
      toast.error('Network inspector connection failed');
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const cb = callbacksRef.current[msg.id];
        if (cb) {
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
          delete callbacksRef.current[msg.id];
        }
      } catch {
        // ignore
      }
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  };

  useEffect(() => () => wsRef.current?.close(), []);

  return { connected, connecting, send, connect, disconnect, wsRef };
}

export default function SessionNetworkInspector({ session }) {
  const { connected, connecting, connect, disconnect, send, wsRef } = useNetworkSocket(session);
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('');
  const [capturing, setCapturing] = useState(false);
  const requestMapRef = useRef({});

  useEffect(() => {
    if (!connected || !wsRef.current) return;

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Network.requestWillBeSent') {
          const req = msg.params;
          requestMapRef.current[req.requestId] = {
            id: req.requestId,
            url: req.request.url,
            method: req.request.method,
            type: req.type,
            status: 'pending',
            startedAt: req.timestamp,
          };
          setEntries(prev => [requestMapRef.current[req.requestId], ...prev].slice(0, 200));
        }
        if (msg.method === 'Network.responseReceived') {
          const res = msg.params;
          const existing = requestMapRef.current[res.requestId];
          if (!existing) return;
          requestMapRef.current[res.requestId] = {
            ...existing,
            status: res.response.status,
            mimeType: res.response.mimeType,
            remoteIP: res.response.remoteIPAddress,
          };
          setEntries(prev => prev.map(item => item.id === res.requestId ? requestMapRef.current[res.requestId] : item));
        }
        if (msg.method === 'Network.loadingFailed') {
          const fail = msg.params;
          const existing = requestMapRef.current[fail.requestId];
          if (!existing) return;
          requestMapRef.current[fail.requestId] = {
            ...existing,
            status: 'failed',
            errorText: fail.errorText,
          };
          setEntries(prev => prev.map(item => item.id === fail.requestId ? requestMapRef.current[fail.requestId] : item));
        }
      } catch {
        // ignore
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => wsRef.current?.removeEventListener('message', handleMessage);
  }, [connected, wsRef]);

  const startCapture = async () => {
    setCapturing(true);
    try {
      await send('Network.enable');
      toast.success('Network capture started');
    } catch (error) {
      toast.error(error.message);
    }
    setCapturing(false);
  };

  const exportHar = () => {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'BB Concurrency Lab', version: '1.0' },
        entries: entries.map((entry) => ({
          startedDateTime: new Date().toISOString(),
          request: {
            method: entry.method,
            url: entry.url,
            headers: [],
          },
          response: {
            status: typeof entry.status === 'number' ? entry.status : 0,
            statusText: String(entry.status || ''),
            headers: [],
            content: { mimeType: entry.mimeType || '' },
          },
        })),
      },
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `har-${session.id.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const visibleEntries = entries.filter(entry =>
    !filter || entry.url.toLowerCase().includes(filter.toLowerCase()) || String(entry.status).includes(filter)
  );

  if (session?.status !== 'RUNNING') {
    return <div className="flex items-center justify-center py-10 text-sm text-gray-500">Session must be running to inspect network traffic.</div>;
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-xs font-mono text-gray-400 flex-1">
          {connecting ? 'CONNECTING…' : connected ? 'NETWORK INSPECTOR CONNECTED' : 'NETWORK INSPECTOR DISCONNECTED'}
        </span>
        {connected ? (
          <Button size="sm" onClick={disconnect} className="h-8 bg-red-700 hover:bg-red-800 text-white gap-1.5 text-xs">
            <WifiOff className="w-3 h-3" /> Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={connect} disabled={connecting} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
            {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
            Connect
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button onClick={startCapture} disabled={!connected || capturing} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs h-8">
          {capturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          Start Capture
        </Button>
        <Button onClick={exportHar} disabled={entries.length === 0} variant="outline" className="border-gray-700 text-gray-300 gap-1.5 text-xs h-8">
          <Download className="w-3 h-3" /> Export HAR
        </Button>
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-500" />
          <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter URL or status" className="pl-7 bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {visibleEntries.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-600">No network traffic captured yet</div>
        ) : visibleEntries.map(entry => (
          <div key={entry.id} className="rounded-lg border border-gray-800 bg-gray-800/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white font-medium break-all">{entry.url}</div>
                <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-2">
                  <span>{entry.method}</span>
                  <span>{entry.type || 'other'}</span>
                  {entry.mimeType && <span>{entry.mimeType}</span>}
                  {entry.remoteIP && <span>{entry.remoteIP}</span>}
                </div>
              </div>
              <Badge className={`${entry.status === 'failed' || Number(entry.status) >= 400 ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                {entry.status}
              </Badge>
            </div>
            {entry.errorText && <div className="text-[11px] text-red-300 mt-2">{entry.errorText}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}