/**
 * Side-by-side compare table — parent run failed outcome vs heal-run new
 * outcome — joined by username. Shows status pills, transition arrows,
 * and a deep-link to the heal session's recording.
 */
import { ExternalLink, ArrowRight } from 'lucide-react';
import { sessionInspectorUrl } from '@/lib/browserbaseUrls';

const STATUS_STYLES = {
  passed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  review: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
  failed: 'text-red-300 bg-red-500/10 border-red-500/30',
  running: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  queued: 'text-gray-400 bg-gray-800/60 border-gray-700',
};

function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.queued;
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${cls}`}>
      {status || '—'}
    </span>
  );
}

export default function RemediationCompareTable({ parentRun, healRun }) {
  const parentByUser = new Map((parentRun?.results || []).map((r) => [r.username, r]));
  const healByUser = new Map((healRun?.results || []).map((r) => [r.username, r]));
  const usernames = Array.from(healByUser.keys());

  if (!usernames.length) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm text-gray-500">
        Heal-run has no rows yet — waiting for results…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500 flex items-center justify-between">
        <span>Before vs After ({usernames.length})</span>
        <span className="text-[10px] text-gray-600">Heal run · {new Date(healRun.startedAt).toLocaleString()}</span>
      </div>
      <div className="divide-y divide-gray-800/70">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 bg-gray-900/40">
          <div className="col-span-3">Username</div>
          <div className="col-span-3">Before</div>
          <div className="col-span-1" />
          <div className="col-span-3">After</div>
          <div className="col-span-2 text-right">Session</div>
        </div>
        {usernames.map((username) => {
          const before = parentByUser.get(username);
          const after = healByUser.get(username);
          const improved = before?.status !== 'passed' && after?.status === 'passed';
          const sessionUrl = after?.sessionId ? sessionInspectorUrl(after.sessionId) : null;
          return (
            <div key={username} className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-xs items-center ${improved ? 'bg-emerald-500/5' : ''}`}>
              <div className="col-span-3 font-mono text-gray-200 truncate" title={username}>{username}</div>
              <div className="col-span-3 flex items-center gap-2">
                <StatusPill status={before?.status} />
                <span className="text-[10px] text-gray-500 truncate" title={before?.outcome}>{before?.outcome || '—'}</span>
              </div>
              <div className="col-span-1 flex justify-center text-gray-600">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <StatusPill status={after?.status} />
                <span className="text-[10px] text-gray-500 truncate" title={after?.outcome}>{after?.outcome || '—'}</span>
              </div>
              <div className="col-span-2 text-right">
                {sessionUrl ? (
                  <a href={sessionUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300">
                    <ExternalLink className="w-3 h-3" /> Recording
                  </a>
                ) : (
                  <span className="text-[10px] text-gray-600">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}