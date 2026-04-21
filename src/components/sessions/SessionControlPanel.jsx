/**
 * SessionControlPanel — guides users to the CDP tab (which implements real
 * mouse/keyboard/screenshot via the CDP WebSocket) and surfaces locally-saved
 * snapshots captured from there. No stubbed actions.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Cpu, Trash2, Download, Image, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';

const SNAPSHOT_STORAGE_KEY = 'bb_snapshots';

function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function SessionControlPanel({ session }) {
  const isRunning = session.status === 'RUNNING';
  const [snapshots, setSnapshots] = useState(loadSnapshots);

  const deleteSnapshot = (id) => {
    const updated = snapshots.filter(s => s.id !== id);
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(updated));
    setSnapshots(updated);
  };

  const clearAll = () => {
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
    <div className="p-4 space-y-4 overflow-y-auto max-h-full">
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-1">
          <Cpu className="w-4 h-4" /> Live Control via CDP
        </div>
        <p className="text-xs text-cyan-100/80">
          Mouse, keyboard and screenshot control are performed directly through the
          Chrome DevTools Protocol WebSocket. Open the <strong>CDP tab</strong> to connect
          and drive this session in real time.
        </p>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-orange-400" /> Saved CDP Snapshots
          </div>
          {snapshots.length > 0 && (
            <button onClick={clearAll} className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {snapshots.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-600">
            No snapshots yet. Capture them from the CDP tab.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.filter(s => s.sessionId === session.id || !s.sessionId).slice(0, 10).map(snap => (
              <div key={snap.id} className="bg-gray-800/60 rounded-lg p-2.5 flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-300 truncate">
                    {snap.sessionId?.slice(0, 14) || session.id.slice(0, 14)}…
                  </div>
                  <div className="text-[11px] text-gray-600">{new Date(snap.timestamp).toLocaleString()}</div>
                </div>
                {snap.dataUrl && (
                  <a href={snap.dataUrl} download={`snapshot-${snap.id}.png`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-blue-400">
                      <Download className="w-3 h-3" />
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="ghost" onClick={() => deleteSnapshot(snap.id)}
                  className="h-7 w-7 text-gray-600 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}