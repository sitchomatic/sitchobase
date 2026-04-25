import { CheckCircle, AlertCircle, Clock, HelpCircle } from 'lucide-react';

const stats = [
  { key: 'passed', label: 'Passed', icon: CheckCircle, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'review', label: 'Review', icon: HelpCircle, className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  { key: 'failed', label: 'Failed', icon: AlertCircle, className: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { key: 'queued', label: 'Queued', icon: Clock, className: 'text-gray-400 bg-gray-800 border-gray-700' },
];

export default function AuthorizedBulkSummary({ rows }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ key, label, icon: Icon, className }) => {
        const count = rows.filter((row) => row.status === key).length;
        return (
          <div key={key} className={`rounded-xl border p-4 ${className}`}>
            <Icon className="w-4 h-4 mb-2" />
            <div className="text-2xl font-bold font-mono">{count}</div>
            <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
          </div>
        );
      })}
    </div>
  );
}