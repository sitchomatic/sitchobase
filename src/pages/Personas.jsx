import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/shared/EmptyState';
import PersonaCsvImport from '@/components/personas/PersonaCsvImport';
import { Users, Plus, Trash2, Edit, Shield, Smartphone, Monitor, Tablet } from 'lucide-react';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

const deviceIcons = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
const regionColors = {
  'us-west-2': 'text-blue-400',
  'us-east-1': 'text-emerald-400',
  'eu-central-1': 'text-purple-400',
  'ap-southeast-1': 'text-orange-400',
};

export default function Personas() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm());

  const { data: personas = [] } = useQuery({
    queryKey: ['personas'],
    queryFn: () => base44.entities.Persona.list(),
    initialData: [],
  });

  function defaultForm() {
    return { name: '', userAgent: '', region: 'us-west-2', useProxy: false, proxyCountry: '', deviceType: 'desktop', notes: '' };
  }

  const loadPersonas = async () => {
    await queryClient.invalidateQueries({ queryKey: ['personas'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ currentForm, currentEditing }) => currentEditing
      ? base44.entities.Persona.update(currentEditing.id, currentForm)
      : base44.entities.Persona.create(currentForm),
    onMutate: async ({ currentForm, currentEditing }) => {
      await queryClient.cancelQueries({ queryKey: ['personas'] });
      const previous = queryClient.getQueryData(['personas']) || [];
      const optimisticId = currentEditing?.id || `temp-${Date.now()}`;
      queryClient.setQueryData(['personas'], currentEditing
        ? previous.map(persona => persona.id === currentEditing.id ? { ...persona, ...currentForm } : persona)
        : [{ ...currentForm, id: optimisticId }, ...previous]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(['personas'], context?.previous || []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Persona.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['personas'] });
      const previous = queryClient.getQueryData(['personas']) || [];
      queryClient.setQueryData(['personas'], previous.filter(persona => persona.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(['personas'], context?.previous || []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
    }
  });

  const openCreate = () => { setEditing(null); setForm(defaultForm()); setShowForm(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setShowForm(true); };

  const save = async () => {
    if (!form.name) return toast.error('Name is required');
    await saveMutation.mutateAsync({ currentForm: form, currentEditing: editing });
    toast.success(editing ? 'Persona updated' : 'Persona created');
    auditLog({ action: editing ? 'PERSONA_UPDATED' : 'PERSONA_CREATED', category: 'persona', targetId: editing?.id, details: { name: form.name } });
    setShowForm(false);
    loadPersonas();
  };

  const remove = async (id) => {
    const p = personas.find(x => x.id === id);
    await deleteMutation.mutateAsync(id);
    toast.success('Persona deleted');
    auditLog({ action: 'PERSONA_DELETED', category: 'persona', targetId: id, details: { name: p?.name } });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Identity & Proxy Personas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stealth profiles with pre-configured user agents and geo-proxies</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-1.5">
          <Plus className="w-4 h-4" /> New Persona
        </Button>
      </div>

      <PersonaCsvImport onImported={loadPersonas} />

      {personas.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No personas yet"
          description="Create stealth profiles with user agents and geo-proxy settings to use across sessions."
          action={
            <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
              <Plus className="w-4 h-4" /> Create First Persona
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map(p => {
            const DeviceIcon = deviceIcons[p.deviceType] || Monitor;
            return (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <DeviceIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className={`text-xs ${regionColors[p.region] || 'text-gray-400'}`}>{p.region}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="w-7 h-7 text-gray-500 hover:text-gray-200">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)} className="w-7 h-7 text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {p.useProxy && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <Shield className="w-3 h-3" />
                      Proxy {p.proxyCountry ? `(${p.proxyCountry.toUpperCase()})` : 'enabled'}
                    </div>
                  )}
                  {p.userAgent && (
                    <div className="text-xs text-gray-500 truncate">{p.userAgent}</div>
                  )}
                  {p.notes && <div className="text-xs text-gray-600 italic">{p.notes}</div>}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize`}>
                    {p.deviceType}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Persona' : 'New Persona'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="e.g. Mobile User - UK" className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Region</Label>
                <Select value={form.region} onValueChange={v => setForm(f => ({...f, region: v}))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {['us-west-2','us-east-1','eu-central-1','ap-southeast-1'].map(r => (
                      <SelectItem key={r} value={r} className="text-gray-200">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Device Type</Label>
                <Select value={form.deviceType} onValueChange={v => setForm(f => ({...f, deviceType: v}))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {['desktop','mobile','tablet'].map(d => (
                      <SelectItem key={d} value={d} className="text-gray-200 capitalize">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">User Agent</Label>
              <Input value={form.userAgent} onChange={e => setForm(f => ({...f, userAgent: e.target.value}))}
                placeholder="Mozilla/5.0 …" className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 text-sm flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Use Residential Proxy
              </Label>
              <Switch checked={form.useProxy} onCheckedChange={v => setForm(f => ({...f, useProxy: v}))} />
            </div>
            {form.useProxy && (
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Proxy Country (ISO code)</Label>
                <Input value={form.proxyCountry} onChange={e => setForm(f => ({...f, proxyCountry: e.target.value}))}
                  placeholder="GB, JP, DE…" className="bg-gray-800 border-gray-700 text-gray-200" />
              </div>
            )}
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                placeholder="Optional notes" className="bg-gray-800 border-gray-700 text-gray-200" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              <Button onClick={save} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}