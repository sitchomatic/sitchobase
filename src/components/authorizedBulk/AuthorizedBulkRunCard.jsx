import { Link } from 'react-router-dom';
import { Clock, ExternalLink } from 'lucide-react';

const statusClass = {
  running: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  stopped: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export default function AuthorizedBulkRunCard({ run }) {
  const total = Math.max(1, run.totalRows || 0);
  const finished = (run.passedCount || 0) + (run.reviewCount || 0) + (run.failedCount || 0);
  const pct = Math.round((finished / total) * 100);

  return (
    <Link to={`/bulk/runs/${run.id}`} className="block rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-emerald-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase font-mono ${statusClass[run.status] || statusClass.running}`}>{run.status}</span>
            <span className="text-xs text-gray-500 truncate">{run.targetHost}</span>
          </div>
          <div className="text-sm text-white truncate">{run.targetUrl}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
            <Clock className="w-3 h-3" />
            {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Unknown start'}
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-600 flex-shrink-0" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{finished}/{run.totalRows || 0} rows</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-emerald-500/10 text-emerald-300 px-2 py-1">Pass {run.passedCount || 0}</div>
          <div className="rounded-lg bg-yellow-500/10 text-yellow-300 px-2 py-1">Review {run.reviewCount || 0}</div>
          <div className="rounded-lg bg-red-500/10 text-red-300 px-2 py-1">Fail {run.failedCount || 0}</div>
        </div>
      </div>
    </Link>
  );
}