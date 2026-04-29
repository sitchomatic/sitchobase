import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Layers, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function FleetContextPicker({ contextId, setContextId }) {
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState(null); // null | 'valid' | 'invalid'
  const [savedContexts, setSavedContexts] = useState([]);

  useEffect(() => {
    base44.entities.BrowserContext.filter({ status: 'active' }, '-created_date', 25)
      .then(records => setSavedContexts(Array.isArray(records) ? records : []))
      .catch(() => setSavedContexts([]));
  }, []);

  const validate = async () => {
    if (!contextId) return;
    setValidating(true);
    setStatus(null);
    try {
      await bbClient.getContext(contextId);
      setStatus('valid');
      toast.success('Context verified');
    } catch {
      setStatus('invalid');
      toast.error('Context not found');
    }
    setValidating(false);
  };

  return (
    <div>
      <Label className="text-gray-400 text-xs mb-2 block flex items-center gap-1.5">
        <Layers className="w-3 h-3 text-purple-400" /> Saved Login / Cookies (optional)
      </Label>
      <div className="text-[11px] text-gray-500 mb-2">
        Reuse a saved browser profile so sessions start already logged in. Leave blank to start fresh.
      </div>
      {savedContexts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {savedContexts.slice(0, 4).map(ctx => (
            <button
              key={ctx.id}
              type="button"
              onClick={() => { setContextId(ctx.contextId); setStatus(null); }}
              className="rounded border border-purple-500/20 bg-purple-500/5 px-2 py-1 text-[11px] text-purple-300 hover:bg-purple-500/10"
            >
              {ctx.contextId.slice(0, 12)}…
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={contextId} onChange={e => { setContextId(e.target.value.trim()); setStatus(null); }}
          placeholder="Pick a saved profile above, or paste an ID"
          className="bg-gray-800 border-gray-700 text-gray-200 text-xs h-8 flex-1" />
        <Button size="sm" onClick={validate} disabled={!contextId || validating}
          className="h-8 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1">
          {validating ? <Loader2 className="w-3 h-3 animate-spin" /> :
           status === 'valid' ? <CheckCircle className="w-3 h-3" /> :
           status === 'invalid' ? <XCircle className="w-3 h-3" /> : null}
          Verify
        </Button>
      </div>
      {status === 'valid' && <div className="text-[11px] text-emerald-400 mt-1">Profile found — sessions will reuse it</div>}
      {status === 'invalid' && <div className="text-[11px] text-red-400 mt-1">No saved profile with this ID</div>}
    </div>
  );
}