import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MousePointer2, Keyboard, Camera, Send, CheckCircle,
  AlertCircle, Loader2, Image, Trash2, Download
} from 'lucide-react';
import { toast } from 'sonner';

const SNAPSHOT_STORAGE_KEY = 'bb_snapshots';

function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSnapshot(sessionId, dataUrl) {
  const snapshots = loadSnapshots();
  snapshots.unshift({
    id: Date.now(),
    sessionId,
    dataUrl,
    timestamp: new Date().toISOString(),
  });
  // Keep last 20 snapshots
  localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots.slice(0, 20)));
  return snapshots.slice(0, 20);
}

export default function SessionControlPanel({ session }) {
  const isRunning = session.status === 'RUNNING';

  // Mouse state
  const [mouseX, setMouseX] = useState('');
  const [mouseY, setMouseY] = useState('');
  const [mouseAction, setMouseAction] = useState('mousemove');

  // Keyboard state
  const [keyText, setKeyText] = useState('');
  const [keyAction, setKeyAction] = useState('type');

  // Screenshot state
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [captureLoading, setCaptureLoading] = useState(false);

  // Command log
  const [cmdLog, setCmdLog] = useState([]);
  const [sending, setSending] = useState(false);

  const logCmd = (command, status, detail = '') => {
    setCmdLog(prev => [{
      id: Date.now(),
      command,
      status,
      detail,
      time: new Date().toLocaleTimeString(),
    }, ...prev.slice(0, 29)]);
  };

  const sendMouse = async () => {
    toast.info('Use the CDP tab for true live mouse control.');
  };

  const sendKey = async () => {
    toast.info('Use the CDP tab for true live keyboard control.');
  };

  const takeSnapshot = async () => {
    toast.info('Use the CDP tab for true live screenshots.');
  };

  const deleteSnapshot = (id) => {
    const updated = snapshots.filter(s => s.id !== id);
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(updated));
    setSnapshots(updated);
  };

  const clearAllSnapshots = () => {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, '[]');
    setSnapshots([]);
    toast.success('Snapshots cleared');
  };

  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MousePointer2 className="w-8 h-8 text-gray-600 mb-3" />
        <div className="text-sm text-gray-500">Session must be RUNNING to send commands</div>
        <div className="text-xs text-gray-600 mt-1">Current status: {session.status}</div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-full">

      {/* Mouse control */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2.5">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <MousePointer2 className="w-3.5 h-3.5 text-cyan-400" /> Mouse Input
        </div>
        <div className="grid grid-cols-3 gap-1">
          {['mousemove','click','dblclick'].map(a => (
            <button key={a} onClick={() => setMouseAction(a)}
              className={`text-xs px-2 py-1 rounded transition-colors ${mouseAction === a
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-gray-500 text-xs mb-1 block">X</Label>
            <Input value={mouseX} onChange={e => setMouseX(e.target.value)} type="number"
              placeholder="640" className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-gray-500 text-xs mb-1 block">Y</Label>
            <Input value={mouseY} onChange={e => setMouseY(e.target.value)} type="number"
              placeholder="360" className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs" />
          </div>
        </div>
        <Button onClick={sendMouse} disabled={sending} size="sm"
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 gap-1.5">
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send {mouseAction}
        </Button>
      </div>

      {/* Keyboard control */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2.5">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-purple-400" /> Keyboard Input
        </div>
        <div className="grid grid-cols-2 gap-1">
          {['type','keydown','keyup','keypress'].map(a => (
            <button key={a} onClick={() => setKeyAction(a)}
              className={`text-xs px-2 py-1 rounded transition-colors ${keyAction === a
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <Label className="text-gray-500 text-xs mb-1 block">
            {keyAction === 'type' ? 'Text to type' : 'Key (e.g. Enter, Tab, ArrowDown)'}
          </Label>
          <Input value={keyText} onChange={e => setKeyText(e.target.value)}
            placeholder={keyAction === 'type' ? 'Hello world' : 'Enter'}
            className="bg-gray-700 border-gray-600 text-gray-200 h-8 text-xs"
            onKeyDown={e => e.key === 'Enter' && sendKey()} />
        </div>
        <Button onClick={sendKey} disabled={sending} size="sm"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5">
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send {keyAction}
        </Button>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-orange-400" /> Snapshot
          </div>
          {snapshots.length > 0 && (
            <button onClick={clearAllSnapshots}
              className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-0.5 transition-colors">
              <Trash2 className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <Button onClick={takeSnapshot} disabled={captureLoading} size="sm"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 gap-1.5">
          {captureLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          Capture Snapshot
        </Button>
        {snapshots.length === 0 ? (
          <div className="text-center py-3 text-xs text-gray-600">No snapshots yet</div>
        ) : (
          <div className="space-y-2">
            {snapshots.map(snap => (
              <div key={snap.id} className="bg-gray-700/60 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Image className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-gray-400 font-mono">{snap.sessionId?.slice(0, 12)}…</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {snap.screenshotUrl && (
                      <a href={snap.screenshotUrl} target="_blank" rel="noopener noreferrer"
                        className="text-gray-500 hover:text-blue-400 transition-colors">
                        <Download className="w-3 h-3" />
                      </a>
                    )}
                    <button onClick={() => deleteSnapshot(snap.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(snap.timestamp).toLocaleTimeString()}
                </div>
                {snap.note && (
                  <div className="text-xs text-yellow-500/70 italic">{snap.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Command log */}
      {cmdLog.length > 0 && (
        <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5">
          <div className="text-xs font-semibold text-gray-400 mb-1">Command Log</div>
          {cmdLog.map(entry => (
            <div key={entry.id} className="flex items-center gap-2 text-xs">
              {entry.status === 'ok'
                ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
              <span className="text-gray-400 font-mono">{entry.command}</span>
              <span className="text-gray-600">{entry.detail}</span>
              <span className="text-gray-700 ml-auto flex-shrink-0">{entry.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}