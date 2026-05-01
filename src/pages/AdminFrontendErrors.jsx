/**
 * /admin/errors — view captured FrontendError records (#19).
 * Admin-only.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bug, Trash2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ErrorBundleExporter from '@/components/shared/ErrorBundleExporter';

const SOURCE_COLORS = {
  render: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  window_error: 'bg-red-500/10 text-red-300 border-red-500/30',
  unhandled_rejection: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export default function AdminFrontendErrors() {
  const qc = useQueryClient();
  const { data: errors = [], isLoading, refetch } = useQuery({
    queryKey: ['adminFrontendErrors'],
    queryFn: () => base44.entities.FrontendError.list('-created_date', 200),
    initialData: [],
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.FrontendError.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminFrontendErrors'] }),
    onError: (e) => toast.error(`Delete failed: ${e?.message || 'unknown'}`),
  });

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Bug className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Frontend Errors</h1>
              <p className="text-xs text-gray-500">Client-side errors captured by the global reporter (last 200)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-gray-700 text-gray-300 gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Link to="/"><Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Dashboard</Button></Link>
          </div>
        </div>

        <ErrorBundleExporter />

        {isLoading && <div className="text-center text-gray-500 py-10">Loading…</div>}
        {!isLoading && errors.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-10 text-center text-gray-500">
            No frontend errors captured. Healthy! 🎉
          </div>
        )}

        <div className="space-y-2">
          {errors.map((err) => (
            <div key={err.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${SOURCE_COLORS[err.source] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {err.source}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {err.created_date ? formatDistanceToNow(new Date(err.created_date)) + ' ago' : '—'}
                    </span>
                    {err.request_id && (
                      <span className="text-[10px] text-gray-600 font-mono">req: {err.request_id}</span>
                    )}
                  </div>
                  <div className="text-sm text-red-200 break-words">{err.message}</div>
                  {err.url && <div className="text-[11px] text-gray-500 mt-1 truncate">URL: {err.url}</div>}
                  {err.stack && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300">Stack trace</summary>
                      <pre className="text-[10px] text-gray-400 bg-gray-950/60 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap">{err.stack}</pre>
                    </details>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this error record?')) remove.mutate(err.id);
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete"
                  aria-label="Delete error"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}