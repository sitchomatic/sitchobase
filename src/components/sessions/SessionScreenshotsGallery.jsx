import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Download, Trash2, PackageOpen, Loader2, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'bb_snapshots';

function getSessionSnaps(sessionId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return all.filter(s => s.sessionId === sessionId);
  } catch { return []; }
}

function deleteSnapFromStorage(id) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(s => s.id !== id)));
  } catch {}
}

export default function SessionScreenshotsGallery({ session, evidence }) {
  const [snaps, setSnaps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const evidenceSnaps = (evidence?.screenshotLogs || []).map((shot, index) => ({
      id: `${session.id}-evidence-${index}`,
      sessionId: session.id,
      screenshotUrl: shot.url,
      timestamp: shot.timestamp,
      note: shot.name,
      status: shot.status,
      persisted: true,
    }));
    setSnaps([...evidenceSnaps, ...getSessionSnaps(session.id)]);
    setSelected(null);
  }, [session.id, evidence]);

  const deleteSnap = (id) => {
    const snap = snaps.find((s) => s.id === id);
    if (snap?.persisted) {
      toast.error('Persisted evidence screenshots cannot be removed here');
      return;
    }
    deleteSnapFromStorage(id);
    setSnaps(prev => prev.filter(s => s.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('Screenshot removed');
  };

  const downloadOne = async (snap) => {
    if (snap.dataUrl) {
      const a = document.createElement('a');
      a.href = snap.dataUrl;
      a.download = `screenshot-${session.id.slice(0, 8)}-${snap.id}.png`;
      a.click();
    } else if (snap.screenshotUrl) {
      window.open(snap.screenshotUrl, '_blank');
    }
  };

  const downloadAll = async () => {
    const downloadable = snaps.filter(s => s.dataUrl || s.screenshotUrl);
    if (!downloadable.length) { toast.error('No downloadable screenshots'); return; }
    setDownloading(true);
    for (let i = 0; i < downloadable.length; i++) {
      await new Promise(r => setTimeout(r, i * 250));
      const snap = downloadable[i];
      if (snap.dataUrl) {
        const a = document.createElement('a');
        a.href = snap.dataUrl;
        a.download = `screenshot-${i + 1}-${snap.id}.png`;
        a.click();
      } else if (snap.screenshotUrl) {
        try {
          const blob = await fetch(snap.screenshotUrl).then(r => r.blob());
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screenshot-${i + 1}-${snap.id}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { window.open(snap.screenshotUrl, '_blank'); }
      }
    }
    toast.success(`Downloaded ${downloadable.length} screenshot${downloadable.length !== 1 ? 's' : ''}`);
    setDownloading(false);
  };

  if (snaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
          <Image className="w-6 h-6 text-gray-600" />
        </div>
        <div className="text-sm text-gray-500">No screenshots yet</div>
        <p className="text-xs text-gray-600 max-w-[180px]">
          Automated evidence screenshots and manual snapshots will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-400">
          {snaps.length} snapshot{snaps.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={downloadAll} disabled={downloading}
          className="h-7 px-2.5 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
          {downloading ? 'Downloading…' : 'Download All'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {snaps.map(snap => (
              <div key={snap.id}
                onClick={() => setSelected(snap.id === selected?.id ? null : snap)}
                className={`relative group rounded-lg overflow-hidden border cursor-pointer transition-all ${
                  selected?.id === snap.id
                    ? 'border-orange-500/60 ring-1 ring-orange-500/40'
                    : 'border-gray-700 hover:border-gray-500'
                }`}>
                {/* Thumbnail */}
                {snap.dataUrl ? (
                  <img src={snap.dataUrl} alt="screenshot" className="w-full h-24 object-cover bg-gray-800" />
                ) : snap.screenshotUrl ? (
                  <img src={snap.screenshotUrl} alt="screenshot"
                    className="w-full h-24 object-cover bg-gray-800"
                    onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-24 bg-gray-800 flex items-center justify-center">
                    <Image className="w-5 h-5 text-gray-600" />
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                  {(snap.dataUrl || snap.screenshotUrl) && (
                    <button onClick={e => { e.stopPropagation(); downloadOne(snap); }}
                      className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!snap.persisted && (
                    <button onClick={e => { e.stopPropagation(); deleteSnap(snap.id); }}
                      className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Timestamp strip */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-0.5">
                  <span className="text-xs text-gray-300 font-mono">
                    {new Date(snap.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected preview */}
        {selected && (
          <div className="w-40 flex-shrink-0 border-l border-gray-800 flex flex-col bg-gray-900/80 overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800">
              <span className="text-xs text-gray-400 font-semibold">Preview</span>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-2">
              {selected.dataUrl ? (
                <img src={selected.dataUrl} alt="preview" className="w-full rounded border border-gray-700" />
              ) : selected.screenshotUrl ? (
                <img src={selected.screenshotUrl} alt="preview"
                  className="w-full rounded border border-gray-700"
                  onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-16 bg-gray-800 rounded flex items-center justify-center">
                  <Image className="w-5 h-5 text-gray-600" />
                </div>
              )}
              <div className="text-xs text-gray-500">
                {new Date(selected.timestamp).toLocaleString()}
              </div>
              {selected.note && (
                <div className="text-xs text-yellow-500/70 italic leading-relaxed">{selected.note}</div>
              )}
              <div className="space-y-1.5 pt-1">
                {(selected.dataUrl || selected.screenshotUrl) && (
                  <Button size="sm" onClick={() => downloadOne(selected)}
                    className="w-full h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1">
                    <Download className="w-3 h-3" /> Download
                  </Button>
                )}
                {selected.screenshotUrl && (
                  <a href={selected.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="sm" variant="outline"
                      className="w-full h-7 text-xs border-gray-700 text-gray-400 hover:bg-gray-800 gap-1">
                      <ExternalLink className="w-3 h-3" /> Open
                    </Button>
                  </a>
                )}
                {!selected.persisted && (
                  <Button size="sm" variant="ghost" onClick={() => deleteSnap(selected.id)}
                    className="w-full h-7 text-xs text-red-500 hover:bg-red-500/10 gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}