import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApiErrorState({ title = 'Request failed', error, requestId, onRetry }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-red-300">{title}</div>
          <div className="text-xs text-red-200/90 break-words mt-1">{error || 'Unknown error'}</div>
          {requestId && <div className="text-[11px] text-gray-400 mt-2 font-mono">Request ID: {requestId}</div>}
        </div>
      </div>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="border-red-500/30 text-red-200 hover:bg-red-500/10 gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}