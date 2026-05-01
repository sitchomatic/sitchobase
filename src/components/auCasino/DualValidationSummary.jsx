import { CheckCircle, AlertCircle, Clock, HelpCircle, Activity } from 'lucide-react';

const cards = [
  { key: 'passed', label: 'Passed', icon: CheckCircle, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'review', label: 'Review', icon: HelpCircle, className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  { key: 'failed', label: 'Failed', icon: AlertCircle, className: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { key: 'running', label: 'Running', icon: Activity, className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { key: 'queued', label: 'Queued', icon: Clock, className: 'text-gray-400 bg-gray-800 border-gray-700' },
];

export default function DualValidationSummary({ tasksByKey, totalTasks }) {
  const counts = { passed: 0, review: 0, failed: 0, running: 0, queued: 0 };
  for (const t of Object.values(tasksByKey || {})) {
    const s = t?.status || 'queued';
    if (counts[s] !== undefined) counts[s] += 1;
  }
  const accountedFor = counts.passed + counts.review + counts.failed + counts.running;
  counts.queued = Math.max(0, totalTasks - accountedFor);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map(({ key, label, icon: Icon, className }) => (
        <div key={key} className={`rounded-xl border p-4 ${className}`}>
          <Icon className="w-4 h-4 mb-2" />
          <div className="text-2xl font-bold font-mono">{counts[key] || 0}</div>
          <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
        </div>
      ))}
    </div>
  );
}