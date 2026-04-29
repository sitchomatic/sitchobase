/**
 * CloudFunctionLibrary — sidebar panel listing saved Cloud Functions with
 * full lifecycle controls: launch, edit, delete, plus retry on transient
 * errors. Surfaces validation errors from useCloudFunctions inline rather
 * than silently swallowing them.
 */
import { useState } from 'react';
import { useCloudFunctions } from '@/lib/useCloudFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Terminal, Plus, Play, Info, Pencil, Trash2, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { name: '', description: '', script: '', runtime: 'playwright' };

export default function CloudFunctionLibrary({ onLaunch }) {
  const { items, loading, unavailable, error, retry, saveFunction, updateFunction, deleteFunction } = useCloudFunctions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      script: item.script || '',
      runtime: item.runtime || 'playwright',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateFunction(editingId, form);
        toast.success('Cloud function updated');
      } else {
        await saveFunction(form);
        toast.success('Cloud function saved');
      }
      setForm(EMPTY);
      setEditingId(null);
      setOpen(false);
    } catch (err) {
      if (err?.entityMissing) {
        setOpen(false);
        toast.error('Cloud Functions entity is not deployed to this Base44 app');
      } else {
        toast.error(err?.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setDeletingId(item.id);
    try {
      await deleteFunction(item.id);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" /> Cloud Function Library
        </div>
        {!unavailable && (
          <Button size="sm" variant="ghost" onClick={openCreate} className="text-cyan-400 hover:bg-cyan-500/10 gap-1">
            <Plus className="w-3 h-3" /> New
          </Button>
        )}
      </div>

      {unavailable ? (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/90">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
          <div className="space-y-1.5 flex-1">
            <div className="font-semibold text-yellow-300">Cloud Functions not deployed</div>
            <div className="text-yellow-200/70 leading-relaxed">
              The <code className="text-yellow-100 bg-yellow-500/10 px-1 rounded">CloudFunction</code> entity is not published to this Base44 app yet.
            </div>
            <Button size="sm" variant="ghost" onClick={retry} className="h-6 text-xs text-yellow-200 hover:bg-yellow-500/10 gap-1 px-2">
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
          <div className="space-y-1.5 flex-1">
            <div className="font-semibold">Failed to load</div>
            <div className="opacity-80">{error?.message || 'Unknown error'}</div>
            <Button size="sm" variant="ghost" onClick={retry} className="h-6 text-xs text-red-200 hover:bg-red-500/10 gap-1 px-2">
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </div>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-xs text-gray-500 gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-800/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium truncate">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description || 'No description'}</div>
                </div>
                <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 capitalize flex-shrink-0">{item.runtime || 'playwright'}</Badge>
              </div>
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" onClick={() => onLaunch(item)} className="bg-cyan-500 hover:bg-cyan-600 text-black gap-1.5 flex-1">
                  <Play className="w-3 h-3" /> Launch
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-2" title="Edit">
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(item)} disabled={deletingId === item.id}
                  className="border-red-800 text-red-400 hover:bg-red-500/10 px-2" title="Delete">
                  {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-xs text-gray-600 text-center py-6">No cloud functions yet</div>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Cloud Function' : 'New Cloud Function'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="bg-gray-800 border-gray-700 text-gray-200" />
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Runtime</Label>
                <Select value={form.runtime} onValueChange={(v) => setForm((p) => ({ ...p, runtime: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 text-gray-200">
                    <SelectItem value="playwright">playwright</SelectItem>
                    <SelectItem value="puppeteer">puppeteer</SelectItem>
                    <SelectItem value="stagehand">stagehand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Script</Label>
              <Textarea value={form.script} onChange={(e) => setForm((p) => ({ ...p, script: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-gray-200 min-h-[180px] font-mono text-xs" />
              <div className="text-[11px] text-gray-600 mt-1">{form.script.length.toLocaleString()} chars</div>
            </div>
            <Button onClick={submit} disabled={saving || !form.name.trim() || !form.script.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black">
              {saving ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Saving…</> : (editingId ? 'Update Function' : 'Save Function')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}