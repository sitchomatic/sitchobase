/**
 * /admin/slow — slow call log (#18). Admin-only.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export default function AdminSlowCalls() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['slowCalls'],
    queryFn: () => base44.entities.SlowCall.list('-created_date', 100),
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Slow Calls</h1>
              <p className="text-xs text-gray-500">bbProxy calls exceeding 10s — investigate for systemic issues</p>
            </div>
          </div>
          <Link to="/"><Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Dashboard</Button></Link>
        </div>

        {isLoading && <div className="text-center text-gray-500 py-10">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-10 text-center text-gray-500">
            No slow calls recorded. Good news.
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800/60">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-yellow-400">{r.duration_ms}ms</span>
                  <span className="text-gray-300">{r.action}</span>
                  <span className="text-gray-600">· {r.actor}</span>
                </div>
                <span className="text-gray-600">{r.created_date ? formatDistanceToNow(new Date(r.created_date)) + ' ago' : '—'}</span>
              </div>
              {r.params_summary && (
                <div className="mt-1 font-mono text-[10px] text-gray-500 truncate">{r.params_summary}</div>
              )}
              {r.request_id && (
                <div className="mt-0.5 font-mono text-[10px] text-gray-600">rid: {r.request_id}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}