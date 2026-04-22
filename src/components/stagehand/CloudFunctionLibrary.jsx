import { useState } from 'react';
import { useCloudFunctions } from '@/lib/useCloudFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Terminal, Plus, Play, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function CloudFunctionLibrary({ onLaunch }) {
  const { items, unavailable, saveFunction } = useCloudFunctions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', script: '', runtime: 'playwright' });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveFunction(form);
      setForm({ name: '', description: '', script: '', runtime: 'playwright' });
      setOpen(false);
      toast.success('Cloud function saved');
    } catch (err) {
      if (err?.entityMissing) {
        setOpen(false);
        toast.error('Cloud Functions entity is not deployed to this Base44 app');
      } else {
        toast.error(`Save failed: ${err?.message || 'unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" /> Cloud Function Library
        </div>
        {!unavailable && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="text-cyan-400 hover:bg-cyan-500/10 gap-1">
            <Plus className="w-3 h-3" /> New
          </Button>
        )}
      </div>

      {unavailable ? (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/90">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
          <div className="space-y-1">
            <div className="font-semibold text-yellow-300">Cloud Functions not deployed</div>
            <div className="text-yellow-200/70 leading-relaxed">
              The <code className="text-yellow-100 bg-yellow-500/10 px-1 rounded">CloudFunction</code> entity is not published to this Base44 app yet. Publish{' '}
              <code className="text-yellow-100 bg-yellow-500/10 px-1 rounded">base44/entities/CloudFunction.jsonc</code> via the Base44 Builder to enable this library.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-800/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-white font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.description || 'No description'}</div>
                </div>
                <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 capitalize">{item.runtime}</Badge>
              </div>
              <Button size="sm" onClick={() => onLaunch(item)} className="mt-3 bg-cyan-500 hover:bg-cyan-600 text-black gap-1.5">
                <Play className="w-3 h-3" /> Launch
              </Button>
            </div>
          ))}
          {items.length === 0 && <div className="text-xs text-gray-600 text-center py-6">No cloud functions yet</div>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>New Cloud Function</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Description</Label>
              <Input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Script</Label>
              <Textarea value={form.script} onChange={e => setForm(prev => ({ ...prev, script: e.target.value }))} className="bg-gray-800 border-gray-700 text-gray-200 min-h-[180px] font-mono text-xs" />
            </div>
            <Button onClick={save} disabled={saving || !form.name || !form.script} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black">
              {saving ? 'Saving…' : 'Save Function'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
