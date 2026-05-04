import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw } from 'lucide-react';
import FailureScreenshotCarousel from '@/components/authorizedBulk/FailureScreenshotCarousel';

function getLastSuccessfulBaseline(run, allRuns, evidenceList) {
  const currentStartedAt = run?.startedAt || run?.created_date || '';
  const targetHost = run?.targetHost;
  const candidates = (allRuns || [])
    .filter((candidate) => candidate.id !== run?.id && candidate.targetHost === targetHost && candidate.status === 'completed')
    .filter((candidate) => !currentStartedAt || (candidate.completedAt || candidate.created_date || '') < currentStartedAt)
    .sort((a, b) => String(b.completedAt || b.created_date || '').localeCompare(String(a.completedAt || a.created_date || '')));

  const baselineByRowIndex = new Map();
  for (const candidate of candidates) {
    for (const result of candidate.results || []) {
      if (result.status !== 'passed' || !result.sessionId || baselineByRowIndex.has(result.index)) continue;
      const evidence = (evidenceList || []).find((item) => item.browserbaseSessionId === result.sessionId);
      const frame = evidence?.screenshotLogs?.slice(-1)?.[0];
      if (frame?.url) baselineByRowIndex.set(result.index, frame.url);
    }
  }
  return baselineByRowIndex;
}

const FAILURE_STATUSES = new Set(['failed', 'review']);
const FAILURE_FRAME_STATUSES = new Set(['failed', 'review']);

function buildFailureItems(run, evidenceList, baselineByRowIndex) {
  const failedRows = (run?.results || []).filter((row) => FAILURE_STATUSES.has(row.status));
  const rowByIndex = new Map(failedRows.map((row) => [row.index, row]));

  return (evidenceList || []).flatMap((evidence) => {
    const row = rowByIndex.get(evidence.rowIndex);
    if (!row) return [];

    const frames = evidence.screenshotLogs || [];
    const failureFrames = frames.filter((frame) => FAILURE_FRAME_STATUSES.has(frame.status));
    const selectedFrames = failureFrames.length ? failureFrames : frames.slice(-1);

    return selectedFrames.map((frame) => ({
      ...frame,
      rowIndex: evidence.rowIndex,
      username: row.username,
      rowStatus: row.status,
      outcome: row.outcome,
      sessionId: row.sessionId || evidence.browserbaseSessionId,
      baselineUrl: baselineByRowIndex.get(row.index),
    }));
  });
}

export default function FailureScreenshotReview({ run }) {
  const { data: runList = [] } = useQuery({
    queryKey: ['failureScreenshotReviewRuns', run?.targetHost],
    queryFn: () => base44.entities.AuthorizedBulkQARun.filter({ targetHost: run.targetHost }, '-startedAt', 25),
    enabled: !!run?.targetHost,
    initialData: [],
  });

  const sessionIds = useMemo(() => {
    const ids = new Set((run?.results || []).map((row) => row.sessionId).filter(Boolean));
    for (const priorRun of runList || []) {
      for (const result of priorRun.results || []) {
        if (result.status === 'passed' && result.sessionId) ids.add(result.sessionId);
      }
    }
    return Array.from(ids);
  }, [run, runList]);

  const { data: evidenceList = [], isFetching, refetch } = useQuery({
    queryKey: ['failureScreenshotReviewEvidence', run?.id, sessionIds.join('|')],
    queryFn: async () => {
      const batches = await Promise.all(sessionIds.map((sessionId) => base44.entities.AutomationEvidence.filter({ browserbaseSessionId: sessionId })));
      return batches.flat();
    },
    enabled: !!run?.id,
    initialData: [],
  });

  const baselineByRowIndex = useMemo(() => getLastSuccessfulBaseline(run, runList, evidenceList), [run, runList, evidenceList]);
  const items = useMemo(() => buildFailureItems(run, evidenceList, baselineByRowIndex), [run, evidenceList, baselineByRowIndex]);
  const failureCount = (run?.results || []).filter((row) => FAILURE_STATUSES.has(row.status)).length;

  if (!run || failureCount === 0) return null;

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Camera className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Failure Screenshot Review</h2>
            <p className="text-xs text-gray-500">Click through failed/review rows to spot UI changes or temporary site blocks.</p>
          </div>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <FailureScreenshotCarousel items={items} />
    </section>
  );
}