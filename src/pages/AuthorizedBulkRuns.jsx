import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import ApiErrorState from '@/components/shared/ApiErrorState';
import { ArrowLeft, History, RefreshCw, Play, ClipboardList } from 'lucide-react';
import AuthorizedBulkRunCard from '@/components/authorizedBulk/AuthorizedBulkRunCard';
import AuthorizedBulkRunResults from '@/components/authorizedBulk/AuthorizedBulkRunResults';
import AuthorizedBulkMetric from '@/components/authorizedBulk/AuthorizedBulkMetric';
import RemediationPanel from '@/components/authorizedBulk/RemediationPanel';
import { getAuthorizedBulkStats } from '@/lib/authorizedBulkStats';

export default function AuthorizedBulkRuns() {
  const { id } = useParams();
  const { data: runs = [], isFetching, isError, error, refetch } = useQuery({
    queryKey: ['authorizedBulkRuns'],
    queryFn: () => base44.entities.AuthorizedBulkQARun.list('-startedAt', 100),
    initialData: [],
    refetchInterval: 10_000,
  });

  const selectedRun = useMemo(() => runs.find((run) => run.id === id), [runs, id]);
  const selectedStats = useMemo(() => getAuthorizedBulkStats(selectedRun?.results || []), [selectedRun]);

  if (id) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/bulk/runs">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {!selectedRun ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-500">Run not found.</div>
        ) : (
          <>
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent p-5">
              <div className="text-xs uppercase font-mono text-emerald-400 mb-2">{selectedRun.status}</div>
              <h1 className="text-xl font-bold text-white truncate">{selectedRun.targetHost}</h1>
              <p className="text-sm text-gray-400 truncate mt-1">{selectedRun.targetUrl}</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 text-sm">
                <AuthorizedBulkMetric label="Rows" value={selectedRun.totalRows || selectedStats.total || 0} />
                <AuthorizedBulkMetric label="Passed" value={selectedStats.passed || selectedRun.passedCount || 0} />
                <AuthorizedBulkMetric label="Review" value={selectedStats.review || selectedRun.reviewCount || 0} />
                <AuthorizedBulkMetric label="Failed" value={selectedStats.failed || selectedRun.failedCount || 0} />
                <AuthorizedBulkMetric label="Concurrency" value={selectedRun.concurrency || 1} />
              </div>
            </div>
            <AuthorizedBulkRunResults results={selectedRun.results || []} />
            {!selectedRun.isHealRun && <RemediationPanel parentRun={selectedRun} />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <History className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Authorized QA Run History</h1>
            <p className="text-sm text-gray-500">Saved backend records for recent Authorized Bulk QA runs.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/bulk">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2">
              <Play className="w-4 h-4" /> New Run
            </Button>
          </Link>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {isError ? (
        <ApiErrorState title="Could not load QA history" error={error?.message} onRetry={refetch} />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No saved runs yet"
          description="Start an authorized QA run and the saved results will appear here with trace links."
          action={<Link to="/bulk"><Button size="sm">Start first run</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {runs.map((run) => <AuthorizedBulkRunCard key={run.id} run={run} />)}
        </div>
      )}
    </div>
  );
}