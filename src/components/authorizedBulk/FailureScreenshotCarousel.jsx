import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon } from 'lucide-react';
import PixelDeviationPanel from '@/components/authorizedBulk/PixelDeviationPanel';

export default function FailureScreenshotCarousel({ items }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items?.length]);

  if (!items?.length) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-950 py-10 text-center text-sm text-gray-500">
        No failure screenshots found for this run.
      </div>
    );
  }

  const current = items[Math.min(index, items.length - 1)];
  const go = (delta) => setIndex((prev) => (prev + delta + items.length) % items.length);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden min-h-[360px] flex items-center justify-center relative">
          <img src={current.url} alt={current.name || 'failure screenshot'} className="max-h-[68vh] w-auto object-contain" />
          <Button size="icon" variant="outline" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 border-gray-700 bg-gray-900/80">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 border-gray-700 bg-gray-900/80">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Screenshot {index + 1} of {items.length}</div>
            <div className="text-sm font-semibold text-white mt-1 truncate">{current.username || `Row ${current.rowIndex + 1}`}</div>
            <div className="text-xs text-gray-500 mt-1 line-clamp-3">{current.outcome || 'No outcome saved'}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-2">
              <div className="text-gray-600">Row</div>
              <div className="text-gray-300 font-mono">#{(current.rowIndex ?? 0) + 1}</div>
            </div>
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-2">
              <div className="text-gray-600">Status</div>
              <div className="text-red-300 uppercase">{current.rowStatus || current.status || 'failed'}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">UI change?</span>
            <span className="px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[11px]">Site block?</span>
          </div>

          <PixelDeviationPanel currentUrl={current.url} baselineUrl={current.baselineUrl} />

          {current.sessionId && (
            <a href={`https://www.browserbase.com/sessions/${current.sessionId}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 py-2 border border-emerald-500/20 rounded-lg">
              <ExternalLink className="w-3 h-3" /> Open session
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, i) => (
          <button key={`${item.sessionId}-${item.timestamp}-${i}`} type="button" onClick={() => setIndex(i)} className={`w-24 h-16 rounded-lg border overflow-hidden flex-shrink-0 ${i === index ? 'border-emerald-500' : 'border-gray-800 opacity-70 hover:opacity-100'}`}>
            {item.url ? <img src={item.url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-gray-600 mx-auto" />}
          </button>
        ))}
      </div>
    </div>
  );
}