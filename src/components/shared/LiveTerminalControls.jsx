import { Button } from '@/components/ui/button';
import { Pause, Play, Trash2, Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_OPTIONS = [
  ['all', 'All'],
  ['bbClient', 'BB'],
  ['fetch', 'Fetch'],
  ['xhr', 'XHR'],
  ['console', 'Console'],
];

export default function LiveTerminalControls({ paused, onTogglePause, onClear, onExport, sourceFilter, onSourceFilter, count }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-1 overflow-x-auto">
        <Filter className="h-3 w-3 text-gray-600 mr-1 flex-shrink-0" />
        {SOURCE_OPTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onSourceFilter(key)}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono transition-colors flex-shrink-0',
              sourceFilter === key ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[10px] text-gray-600 font-mono mr-1">{count}</span>
        <Button size="icon" variant="ghost" onClick={onTogglePause} className="h-6 w-6" title={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-gray-400" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={onExport} className="h-6 w-6" title="Export logs">
          <Download className="h-3 w-3 text-gray-400" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onClear} className="h-6 w-6" title="Clear">
          <Trash2 className="h-3 w-3 text-gray-400" />
        </Button>
      </div>
    </div>
  );
}