import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Trash2, Layers, Copy, CheckCircle, Upload, AlertCircle } from 'lucide-react';
import ContextUploadDialog from '@/components/contexts/ContextUploadDialog';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

function normalizeContext(record) {
  return {
    ...record,
    id: record.contextId || record.id,
    registryId: record.id,
    createdAt: record.createdAt || record.created_date,
  };
}

export default function Contexts() {
  const { isConfigured } = useCredentials();
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [uploadingCtx, setUploadingCtx] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    setLoadError(null);
    try {
      const records = await base44.entities.BrowserContext.filter({ status: 'active' }, '-created_date', 100);
      setContexts(Array.isArray(records) ? records.map(normalizeContext) : []);
    } catch (err) {
      setLoadError({
        message: err?.message || 'Failed to load saved contexts',
        isApiKeyLimitation: Boolean(err?.isApiKeyBbProxyLimitation),
      });
      setContexts([]);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const ctx = await bbClient.createContext();
      const saved = await base44.entities.BrowserContext.create({
        contextId: ctx.id,
        uploadUrl: ctx.uploadUrl,
        publicKey: ctx.publicKey,
        initializationVectorSize: ctx.initializationVectorSize,
        cipherAlgorithm: ctx.cipherAlgorithm,
        status: 'active',
      });
      setContexts(prev => [normalizeContext(saved), ...prev]);
      toast.success('Context created');
      auditLog({ action: 'CONTEXT_CREATED', category: 'context', targetId: ctx.id });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (ctx) => {
    await bbClient.deleteContext(ctx.id);
    if (ctx.registryId) {
      await base44.entities.BrowserContext.update(ctx.registryId, { status: 'deleted' });
    }
    setContexts(prev => prev.filter(c => c.id !== ctx.id));
    toast.success('Context deleted');
    auditLog({ action: 'CONTEXT_DELETED', category: 'context', targetId: ctx.id });
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <>
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Persistent Contexts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reusable browser states with cookies & auth tokens</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={create} disabled={creating}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {creating ? 'Creating…' : 'New Context'}
          </Button>
        </div>
      </div>

      {loadError?.isApiKeyLimitation && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Contexts are not available under local API key auth</div>
            <div className="text-xs mt-0.5 opacity-80">{loadError.message}</div>
          </div>
        </div>
      )}

      {!loadError && !loading && contexts.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs text-gray-500">
          Contexts created from this page will be saved here for future reuse.
        </div>
      )}

      {contexts.length === 0 && !loading ? (
        <EmptyState
          icon={Layers}
          title="No contexts listed"
          description="Create a new context and it will be saved here for future reuse."
          action={
            <Button onClick={create} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
              <Plus className="w-4 h-4" /> Create New Context
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && contexts.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-500 text-sm">Loading contexts…</div>
          )}
          {contexts.map(ctx => (
            <div key={ctx.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setUploadingCtx(ctx)}
                    className="w-7 h-7 text-gray-600 hover:text-purple-400" title="Upload user-data-directory">
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(ctx)}
                    className="w-7 h-7 text-gray-600 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Context ID</div>
                <div className="flex items-center gap-1">
                  <code className="text-xs font-mono text-gray-300 truncate flex-1 bg-gray-800 rounded px-2 py-1">
                    {ctx.id}
                  </code>
                  <button onClick={() => copy(ctx.id)} className="text-gray-600 hover:text-gray-300 flex-shrink-0 ml-1">
                    {copiedId === ctx.id
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {ctx.uploadUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Upload URL</div>
                  <a href={ctx.uploadUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 truncate block">
                    {ctx.uploadUrl.slice(0, 40)}…
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-600">Cipher: {ctx.cipherAlgorithm || 'AES-256-CBC'}</span>
                {ctx.createdAt && (
                  <span className="text-xs text-gray-700">{formatDistanceToNow(new Date(ctx.createdAt))} ago</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {uploadingCtx && (
      <ContextUploadDialog context={uploadingCtx} onClose={() => setUploadingCtx(null)} />
    )}
    </>
  );
}