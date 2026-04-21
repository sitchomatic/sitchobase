/**
 * SessionCDPPanel — connects to a live session's CDP WebSocket endpoint
 * to take real screenshots and send mouse/keyboard commands.
 *
 * Browserbase exposes the CDP debugger URL via session.connectUrl (wss://...).
 * We open the WebSocket here in the browser, send CDP commands directly,
 * and decode the base64 screenshot payload inline.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Wifi, WifiOff, Loader2, MousePointer2, Keyboard, Send, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

function useCDPSocket(session) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const callbacksRef = useRef({});
  const cmdIdRef = useRef(1);

  const send = useCallback((method, params = {}) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const id = cmdIdRef.current++;
      callbacksRef.current[id] = { resolve, reject };
      wsRef.current.send(JSON.stringify({ id, method, params }));
      // Timeout after 8s
      setTimeout(() => {
        if (callbacksRef.current[id]) {
          delete callbacksRef.current[id];
          reject(new Error('CDP command timed out'));
        }
      }, 8000);
    });
  }, []);

  const connect = useCallback(() => {
    if (!session?.connectUrl) {
      toast.error('No CDP URL — session must be RUNNING');
      return;
    }
    if (wsRef.current) wsRef.current.close();
    setConnecting(true);

    // BB connectUrl is wss:// format; strip query params and use directly
    const ws = new WebSocket(session.connectUrl);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); setConnecting(false); };
    ws.onclose = () => { setConnected(false); setConnecting(false); };
    ws.onerror = () => { setConnected(false); setConnecting(false); toast.error('CDP WebSocket error'); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.id && callbacksRef.current[msg.id]) {
          if (msg.error) callbacksRef.current[msg.id].reject(new Error(msg.error.message));
          else callbacksRef.current[msg.id].resolve(msg.result);
          delete callbacksRef.current[msg.id];
        }
      } catch {}
    };
  }, [session?.connectUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // Auto-disconnect when session stops
  useEffect(() => {
    if (session?.status !== 'RUNNING') disconnect();
  }, [session?.status, disconnect]);

  useEffect(() => () => wsRef.current?.close(), []);

  return { connected, connecting, connect, disconnect, send };
}

export default function SessionCDPPanel({ session }) {
  const { connected, connecting, connect, disconnect, send } = useCDPSocket(session);
  const [screenshot, setScreenshot] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [mouseX, setMouseX] = useState('640');
  const [mouseY, setMouseY] = useState('360');
  const [keyText, setKeyText] = useState('');
  const [sending, setSending] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isRunning = session?.status === 'RUNNING';

  const capture = async () => {
    setCapturing(true);
    try {
      const result = await send('Page.captureScreenshot', { format: 'png', quality: 80 });
      setScreenshot(`data:image/png;base64,${result.data}`);
      toast.success('Screenshot captured via CDP');
    } catch (err) {
      toast.error(`CDP screenshot failed: ${err.message}`);
    }
    setCapturing(false);
  };

  const sendMouse = async (type) => {
    setSending(true);
    try {
      const x = Number(mouseX), y = Number(mouseY);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      if (type === 'click') {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
      toast.success(`Mouse ${type} sent`);
    } catch (err) {
      toast.error(`Mouse event failed: ${err.message}`);
    }
    setSending(false);
  };

  const sendKey = async () => {
    if (!keyText) return;
    setSending(true);
    try {
      for (const char of keyText) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
      }
      toast.success('Key input sent');
    } catch (err) {
      toast.error(`Key event failed: ${err.message}`);
    }
    setSending(false);
  };

  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <WifiOff className="w-8 h-8 text-gray-600 mb-3" />
        <div className="text-sm text-gray-500">Session must be RUNNING to use CDP</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
      {/* Connection */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-xs font-mono text-gray-400 flex-1">
          {connecting ? 'CONNECTING…' : connected ? 'CDP CONNECTED' : 'CDP DISCONNECTED'}
        </span>
        {connected ? (
          <Button size="sm" onClick={disconnect}
            className="h-7 px-2.5 text-xs bg-red-700 hover:bg-red-800 text-white gap-1.5">
            <WifiOff className="w-3 h-3" /> Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={connect} disabled={connecting}
            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
            Connect CDP
          </Button>
        )}
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-orange-400" /> Live Screenshot
        </div>
        <Button onClick={capture} disabled={!connected || capturing} size="sm"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 gap-1.5">
          {capturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          Capture Screenshot
        </Button>
        {screenshot && (
          <div className="relative group">
            <img src={screenshot} alt="CDP screenshot"
              className="w-full rounded border border-gray-700 cursor-zoom-in"
              onClick={() => setFullscreen(true)} />
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setFullscreen(true)}
                className="bg-black/70 rounded p-1 text-white">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <Button size="sm" onClick={capture} disabled={capturing} variant="outline"
                className="flex-1 h-6 text-xs border-gray-700 text-gray-400">
                Refresh
              </Button>
              <a href={screenshot} download={`cdp-screenshot-${session.id.slice(0,8)}.png`}
                className="flex-1">
                <Button size="sm" variant="outline"
                  className="w-full h-6 text-xs border-gray-700 text-gray-400">
                  Download
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Mouse */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <MousePointer2 className="w-3.5 h-3.5 text-cyan-400" /> Mouse (CDP)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">X</label>
            <Input value={mouseX} onChange={e => setMouseX(e.target.value)} type="number"
              className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Y</label>
            <Input value={mouseY} onChange={e => setMouseY(e.target.value)} type="number"
              className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" onClick={() => sendMouse('move')} disabled={!connected || sending}
            className="bg-cyan-700 hover:bg-cyan-800 text-white text-xs h-8">Move</Button>
          <Button size="sm" onClick={() => sendMouse('click')} disabled={!connected || sending}
            className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8">Click</Button>
        </div>
      </div>

      {/* Keyboard */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-purple-400" /> Keyboard (CDP)
        </div>
        <Input value={keyText} onChange={e => setKeyText(e.target.value)}
          placeholder="Text to type…"
          onKeyDown={e => e.key === 'Enter' && sendKey()}
          className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs" />
        <Button size="sm" onClick={sendKey} disabled={!connected || sending || !keyText}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5">
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send Keystrokes
        </Button>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && screenshot && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}>
          <img src={screenshot} alt="Fullscreen CDP screenshot"
            className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}