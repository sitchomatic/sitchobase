import { OUTCOME_UI, SUMMARY_ORDER } from '@/lib/auCasinoOutcomeUi';

/**
 * Summary tiles for the dual-target validator. One tile per terminal
 * outcome category from GOAL.md (success / noaccount / tempdisabled /
 * permdisabled / na) plus running + queued. Counts are derived from
 * the live `tasksByKey` map the page maintains.
 */
export default function DualValidationSummary({ tasksByKey, totalTasks }) {
  const counts = {};
  for (const key of SUMMARY_ORDER) counts[key] = 0;

  for (const t of Object.values(tasksByKey || {})) {
    const s = t?.status;
    if (s && counts[s] !== undefined) counts[s] += 1;
  }

  const accountedFor = SUMMARY_ORDER
    .filter((k) => k !== 'queued')
    .reduce((sum, k) => sum + counts[k], 0);
  counts.queued = Math.max(0, totalTasks - accountedFor);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
      {SUMMARY_ORDER.map((key) => {
        const meta = OUTCOME_UI[key];
        const Icon = meta.icon;
        return (
          <div key={key} className={`rounded-xl border p-3 ${meta.tile}`}>
            <Icon className={`w-4 h-4 mb-1.5 ${meta.spin ? 'animate-spin' : ''}`} />
            <div className="text-xl font-bold font-mono">{counts[key] || 0}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">{meta.label}</div>
          </div>
        );
      })}
    </div>
  );
}