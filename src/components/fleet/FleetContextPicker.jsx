import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Layers, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { bbClient } from '@/lib/bbClient';
import { toast } from 'sonner';

export default function FleetContextPicker({ contextId, setContextId }) {
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState(null); // null | 'valid' | 'invalid'

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
        <Layers className="w-3 h-3 text-purple-400" /> Reusable Context ID
      </Label>
      <div className="flex gap-2">
        <Input value={contextId} onChange={e => { setContextId(e.target.value); setStatus(null); }}
          placeholder="Paste context ID (optional)"
          className="bg-gray-800 border-gray-700 text-gray-200 text-xs h-8 flex-1" />
        <Button size="sm" onClick={validate} disabled={!contextId || validating}
          className="h-8 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1">
          {validating ? <Loader2 className="w-3 h-3 animate-spin" /> :
           status === 'valid' ? <CheckCircle className="w-3 h-3" /> :
           status === 'invalid' ? <XCircle className="w-3 h-3" /> : null}
          Verify
        </Button>
      </div>
      {status === 'valid' && <div className="text-[11px] text-emerald-400 mt-1">Context verified and ready to reuse</div>}
      {status === 'invalid' && <div className="text-[11px] text-red-400 mt-1">Context ID is invalid</div>}
    </div>
  );
}