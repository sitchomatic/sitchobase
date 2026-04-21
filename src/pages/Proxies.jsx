import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Shield, Upload, Plus, RotateCw } from 'lucide-react';
import ProxyRow from '@/components/proxies/ProxyRow';
import ProxyUploadDialog from '@/components/proxies/ProxyUploadDialog';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

export default function Proxies() {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: proxies = [], isLoading, refetch } = useQuery({
    queryKey: ['proxyPool'],
    queryFn: () => base44.entities.ProxyPool.list('-created_date', 500),
    initialData: [],
  });

  const importMutation = useMutation({
    mutationFn: async (list) => {
      for (const p of list) await base44.entities.ProxyPool.create(p);
    },
    onSuccess: (_d, list) => {
      qc.invalidateQueries({ queryKey: ['proxyPool'] });
      toast.success(`Imported ${list.length} proxies`);
      auditLog({ action: 'PROXY_POOL_IMPORTED', category: 'settings', details: { count: list.length } });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ proxy, enabled }) => base44.entities.ProxyPool.update(proxy.id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxyPool'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (proxy) => base44.entities.ProxyPool.delete(proxy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxyPool'] });
      toast.success('Proxy removed');
    },
  });

  const enabledCount = proxies.filter((p) => p.enabled !== false).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Proxy Pool</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {enabledCount} active · {proxies.length} total · rotated round-robin across Joe Ignite sessions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-gray-700 gap-2">
          <RotateCw className="w-3.5 h-3.5" /> Refresh
        </Button>
        <Button onClick={() => setUploadOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
          <Upload className="w-4 h-4" /> Import Proxies
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 text-sm py-12">Loading proxies…</div>
      ) : proxies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mx-auto mb-3 flex items-center justify-center">
            <Plus className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-white font-semibold mb-1">No proxies yet</div>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Import your proxy list to rotate IPs across Joe Ignite sessions and reduce fingerprinting risk.
          </p>
          <Button onClick={() => setUploadOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
            <Upload className="w-4 h-4" /> Import Proxies
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {proxies.map((p) => (
            <ProxyRow
              key={p.id}
              proxy={p}
              onToggle={(proxy, enabled) => toggleMutation.mutate({ proxy, enabled })}
              onDelete={(proxy) => deleteMutation.mutate(proxy)}
            />
          ))}
        </div>
      )}

      <ProxyUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onImport={(list) => importMutation.mutateAsync(list)}
      />
    </div>
  );
}