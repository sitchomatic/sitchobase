import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Shield } from 'lucide-react';

export default function ProxyRow({ proxy, onToggle, onDelete }) {
  const successRate = proxy.timesUsed > 0
    ? Math.round((proxy.successCount / proxy.timesUsed) * 100)
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-gray-800 rounded-lg bg-gray-900 hover:border-gray-700">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <Shield className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">{proxy.label || proxy.server}</span>
          {proxy.country && <Badge variant="outline" className="text-[10px] border-gray-700">{proxy.country}</Badge>}
          {proxy.provider && <Badge variant="outline" className="text-[10px] border-gray-700">{proxy.provider}</Badge>}
        </div>
        <div className="text-[11px] text-gray-500 font-mono truncate">{proxy.server}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          Used {proxy.timesUsed || 0}× · {successRate !== null ? `${successRate}% success` : 'no data yet'}
        </div>
      </div>
      <Switch checked={proxy.enabled !== false} onCheckedChange={(v) => onToggle(proxy, v)} />
      <Button variant="ghost" size="icon" onClick={() => onDelete(proxy)}
        className="text-gray-500 hover:text-red-400 hover:bg-red-500/10">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}