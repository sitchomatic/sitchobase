import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, KeyRound, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { smartRetryAuthorizedBulkRow } from '@/lib/diagnostics/smartRetry';
import { toast } from 'sonner';

/**
 * Smart Retry — only available for AuthorizedBulkQARun rows (the only
 * source we have the original config for and can re-run from the UI).
 * For other sources we show a deep-link suggestion instead.
 */
export default function SmartRetryDialog({ open, onOpenChange, record, proxies, credentials, suggestedSwap }) {
  const [proxyId, setProxyId] = useState('keep');
  const [credId, setCredId] = useState('keep');
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setProxyId('keep');
    setCredId('keep');
    setResult(null);
  }, [open]);

  const isBulkRow = record?.source === 'AuthorizedBulkQARun';
  const run = isBulkRow ? record?.raw?.run : null;
  const row = isBulkRow ? record?.raw?.row : null;

  const performRetry = async () => {
    setRetrying(true);
    setResult(null);
    const swap = {
      proxy: proxyId === 'keep' ? null : proxies.find((p) => p.id === proxyId),
      credential: credId === 'keep' ? null : credentials.find((c) => c.id === credId),
    };
    const patch = await smartRetryAuthorizedBulkRow({ run, row, swap }).catch((err) => ({ status: 'failed', outcome: err.message }));
    setResult(patch);
    if (patch?.status === 'passed') toast.success('Retry passed');
    else toast.error(`Retry ${patch?.status || 'failed'}`);
    // Update the saved run record so QA history reflects the retry.
    if (run?.id && patch) {
      const updatedResults = (run.results || []).map((r) =>
        r.index === row.index ? { ...r, ...patch } : r
      );
      base44.entities.AuthorizedBulkQARun.update(run.id, { results: updatedResults }).catch(() => null);
    }
    setRetrying(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" /> Retry with suggestions
          </DialogTitle>
        </DialogHeader>

        {!isBulkRow ? (
          <div className="text-sm text-gray-400 space-y-3">
            <p>Smart retry currently only supports Authorized Bulk QA rows because we need the original target URL and selectors to re-run.</p>
            <p className="text-xs">Suggested action: <span className="text-emerald-300 font-semibold">{suggestedSwap?.action}</span></p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs space-y-1">
              <div className="text-gray-500">Target</div>
              <div className="text-gray-200 font-mono truncate">{record?.target}</div>
              <div className="text-gray-500 mt-2">Original error</div>
              <div className="text-red-300">{record?.message}</div>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Suggestion
              </div>
              <div className="text-gray-300 mt-1">{suggestedSwap?.action}</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Proxy swap</label>
              <Select value={proxyId} onValueChange={setProxyId} disabled={retrying}>
                <SelectTrigger className="bg-gray-950 border-gray-800 text-gray-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-gray-200">
                  <SelectItem value="keep">Keep current (no swap)</SelectItem>
                  {proxies.slice(0, 50).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label || p.server}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 flex items-center gap-1.5"><KeyRound className="w-3 h-3" /> Credential swap</label>
              <Select value={credId} onValueChange={setCredId} disabled={retrying}>
                <SelectTrigger className="bg-gray-950 border-gray-800 text-gray-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-gray-200">
                  <SelectItem value="keep">Keep current ({row?.username})</SelectItem>
                  {credentials.slice(0, 50).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.email} · {c.site}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {result && (
              <div className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${result.status === 'passed' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                {result.status === 'passed'
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 mt-0.5" />}
                <div>
                  <div className="font-semibold capitalize">{result.status}</div>
                  <div className="text-gray-400 mt-0.5">{result.outcome}</div>
                  {result.finalUrl && <div className="text-gray-600 font-mono mt-1 truncate">{result.finalUrl}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800">Close</Button>
          {isBulkRow && (
            <Button onClick={performRetry} disabled={retrying}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying…' : 'Retry now'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}