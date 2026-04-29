/**
 * Activity — focused dashboard for Cloud Function executions and Stagehand
 * runs. Reads from the AuditLog entity (the same source of truth used by
 * /audit) but narrows the view to automation activity, with summary cards
 * and a chronological timeline so operators can see at a glance what's
 * been running, by whom, and whether it succeeded.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Activity as ActivityIcon, RefreshCw, Search, Sparkles, Terminal,
  CheckCircle, XCircle, Clock, Filter
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const ACTION_META = {
  CLOUD_FUNCTION_RUN:      { label: 'Cloud Function Run',      icon: Terminal,  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  CLOUD_FUNCTION_SAVED:    { label: 'Cloud Function Saved',    icon: Terminal,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  CLOUD_FUNCTION_UPDATED:  { label: 'Cloud Function Updated',  icon: Terminal,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  CLOUD_FUNCTION_DELETED:  { label: 'Cloud Function Deleted',  icon: Terminal,  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  STAGEHAND_RUN:           { label: 'Stagehand Run',           icon: Sparkles,  color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
};

const ACTION_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All actions' },
  { value: 'CLOUD_FUNCTION_RUN', label: 'Cloud Function Runs' },
  { value: 'STAGEHAND_RUN', label: 'Stagehand Runs' },
  { value: 'CLOUD_FUNCTION_SAVED', label: 'Saves' },
  { value: 'CLOUD_FUNCTION_UPDATED', label: 'Updates' },
  { value: 'CLOUD_FUNCTION_DELETED', label: 'Deletes' },
];

function StatCard({ icon: Icon, label, value, color = 'text-emerald-400' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function detailsSummary(details) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return entries.slice(0, 4).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ');
}

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Pull both categories — Stagehand currently logs under `session`,
      // Cloud Function lifecycle logs under `cloud_function`. Filter at
      // the action level below so future categorization changes don't
      // break this page.
      const data = await base44.entities.AuditLog.list('-created_date', 300);
      const list = Array.isArray(data) ? data : [];
      setLogs(list.filter(l => ACTION_META[l.action]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => logs.filter(l => {
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.action?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.target_id?.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      );
    }
    return true;
  }), [logs, actionFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const cfRuns = logs.filter(l => l.action === 'CLOUD_FUNCTION_RUN').length;
    const shRuns = logs.filter(l => l.action === 'STAGEHAND_RUN').length;
    const failures = logs.filter(l => l.status === 'failure').length;
    const last24h = logs.filter(l => l.created_date && (Date.now() - new Date(l.created_date).getTime()) < 86_400_000).length;
    return { cfRuns, shRuns, failures, last24h };
  }, [logs]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/60 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <ActivityIcon className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Activity</h1>
              <p className="text-xs text-gray-500">Cloud Function & Stagehand execution history · {logs.length} entries</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Terminal} label="Cloud Function runs" value={stats.cfRuns} color="text-cyan-400" />
          <StatCard icon={Sparkles} label="Stagehand runs" value={stats.shRuns} color="text-purple-400" />
          <StatCard icon={Clock} label="Last 24h" value={stats.last24h} color="text-emerald-400" />
          <StatCard icon={XCircle} label="Failures" value={stats.failures} color="text-red-400" />
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex gap-2 flex-wrap items-center">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
            <Input placeholder="Search action, actor, function, prompt…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8" />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-52 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {ACTION_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-gray-200">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {['ALL', 'success', 'failure'].map(s => (
                <SelectItem key={s} value={s} className="text-gray-200 capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">Loading activity…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <ActivityIcon className="w-10 h-10 text-gray-700" />
              <div className="text-gray-500 text-sm">No activity yet</div>
              <div className="text-gray-600 text-xs max-w-xs">
                Cloud Function and Stagehand executions will appear here as they run.
              </div>
            </div>
          )}

          {filtered.map(log => {
            const meta = ACTION_META[log.action] || { label: log.action, icon: ActivityIcon, color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700' };
            const Icon = meta.icon;
            const summary = detailsSummary(log.details);
            return (
              <div key={log.id} className={`flex items-start gap-3 rounded-xl border ${meta.border} ${meta.bg} p-3`}>
                <div className={`w-8 h-8 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                    {log.status === 'success' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 gap-1">
                        <CheckCircle className="w-3 h-3" /> success
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-300 border-red-500/20 gap-1">
                        <XCircle className="w-3 h-3" /> failure
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500 ml-auto" title={log.created_date ? format(new Date(log.created_date), 'PPpp') : ''}>
                      {log.created_date ? formatDistanceToNow(new Date(log.created_date), { addSuffix: true }) : '—'}
                    </span>
                  </div>
                  {summary && (
                    <div className="text-xs text-gray-400 mt-1 truncate" title={JSON.stringify(log.details)}>
                      {summary}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                    <span>{log.actor || 'unknown'}</span>
                    {log.target_id && (
                      <>
                        <span>·</span>
                        <code className="font-mono text-gray-500">{log.target_id.slice(0, 18)}…</code>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}