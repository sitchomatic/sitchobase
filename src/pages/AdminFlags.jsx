/**
 * /admin/flags — feature flag editor (#48). Admin-only.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminFlags() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 200),
    initialData: [],
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FeatureFlag.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['featureFlags'] }),
  });
  const create = useMutation({
    mutationFn: (data) => base44.entities.FeatureFlag.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['featureFlags'] }); setNewKey(''); setNewDesc(''); },
  });
  const remove = useMutation({
    mutationFn: (id) => base44.entities.FeatureFlag.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['featureFlags'] }),
  });

  const onCreate = () => {
    if (!newKey.trim()) return toast.error('Key required');
    create.mutate({ key: newKey.trim(), description: newDesc.trim(), enabled: false, rollout_percentage: 100 });
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Flag className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Feature Flags</h1>
              <p className="text-xs text-gray-500">Ship behind a flag. Rollout is stable per user email.</p>
            </div>
          </div>
          <Link to="/"><Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Dashboard</Button></Link>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="text-sm font-semibold text-white">New flag</div>
          <div className="flex gap-2">
            <Input placeholder="FLAG_KEY" value={newKey} onChange={(e) => setNewKey(e.target.value)}
              className="bg-gray-800 border-gray-700 font-mono text-xs" />
            <Input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              className="bg-gray-800 border-gray-700 text-xs" />
            <Button onClick={onCreate} className="bg-emerald-500 hover:bg-emerald-600 text-black gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>

        {isLoading && <div className="text-center text-gray-500 py-6">Loading…</div>}

        <div className="space-y-2">
          {flags.map((f) => (
            <div key={f.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-emerald-400">{f.key}</div>
                  <div className="text-xs text-gray-500">{f.description || '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={!!f.enabled}
                    onCheckedChange={(v) => update.mutate({ id: f.id, data: { enabled: v } })} />
                  <button onClick={() => remove.mutate(f.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Rollout</span>
                  <span className="text-emerald-400 font-mono">{f.rollout_percentage ?? 100}%</span>
                </div>
                <Slider min={0} max={100} step={5}
                  value={[f.rollout_percentage ?? 100]}
                  onValueChange={([v]) => update.mutate({ id: f.id, data: { rollout_percentage: v } })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}