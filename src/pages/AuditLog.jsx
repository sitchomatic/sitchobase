import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, Shield, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition, slideInVariants } from '@/lib/motion';

const CATEGORY_COLORS = {
  session:        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  context:        'bg-purple-500/20 text-purple-400 border-purple-500/30',
  persona:        'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  fleet:          'bg-orange-500/20 text-orange-400 border-orange-500/30',
  bulk:           'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  settings:       'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cloud_function: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

export default function AuditLog() {
  const navigate = useNavigate();
  const { id: auditId } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.AuditLog.list('-created_date', 200);
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.action?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.target_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedLog = useMemo(
    () => filtered.find(log => log.id === auditId) || logs.find(log => log.id === auditId) || null,
    [filtered, logs, auditId]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/60 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Audit Log</h1>
              <p className="text-xs text-gray-500">{logs.length} immutable entries · team activity tracking</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 min-h-[44px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
            <Input placeholder="Search action, actor, ID…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {['ALL', 'session', 'context', 'persona', 'fleet', 'bulk', 'settings', 'cloud_function'].map(c => (
                <SelectItem key={c} value={c} className="text-gray-200 capitalize">{c}</SelectItem>
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
      </div>

      {/* Log table */}
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-sm">Loading audit log…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Shield className="w-10 h-10 text-gray-700" />
            <div className="text-gray-500 text-sm">No log entries yet</div>
            <div className="text-gray-600 text-xs max-w-xs">
              Entries are recorded automatically when sessions are launched, contexts are modified, and other key actions occur.
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
              <tr className="text-gray-500 text-left">
                <th className="px-4 py-2.5 font-medium">Timestamp</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(log => (
                <tr key={log.id} onClick={() => navigate(`/audit/${log.id}`)} className="hover:bg-gray-800/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">
                    <span title={log.created_date ? format(new Date(log.created_date), 'PPpp') : ''}>
                      {log.created_date ? formatDistanceToNow(new Date(log.created_date), { addSuffix: true }) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-200 font-semibold whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${CATEGORY_COLORS[log.category] || CATEGORY_COLORS.settings}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[160px] truncate">{log.actor}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 max-w-[140px] truncate">
                    {log.target_id || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px]">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <span className="truncate block" title={JSON.stringify(log.details)}>
                        {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.status === 'success'
                      ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> success</span>
                      : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3.5 h-3.5" /> failure</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {selectedLog && (
          <motion.div
            key={selectedLog.id}
            {...slideInVariants()}
            transition={pageTransition()}
            className="fixed md:absolute inset-0 md:inset-y-0 md:right-0 z-30 w-full md:w-[420px] bg-gray-900 border-l border-gray-800"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div>
                <div className="text-sm font-semibold text-white">Audit Entry</div>
                <div className="text-xs text-gray-500 font-mono truncate max-w-[240px]">{selectedLog.id}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] text-gray-400 hover:text-white">
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto h-full pb-24">
              <div className="bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs text-gray-500">Action</div>
                <div className="text-sm text-white font-mono mt-1">{selectedLog.action}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="text-sm text-white capitalize mt-1">{selectedLog.category}</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm text-white capitalize mt-1">{selectedLog.status}</div>
                </div>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs text-gray-500">Actor</div>
                <div className="text-sm text-white mt-1 break-all">{selectedLog.actor}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs text-gray-500">Target</div>
                <div className="text-sm text-white font-mono mt-1 break-all">{selectedLog.target_id || '—'}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs text-gray-500">Timestamp</div>
                <div className="text-sm text-white mt-1">{selectedLog.created_date ? format(new Date(selectedLog.created_date), 'PPpp') : '—'}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs text-gray-500">Details</div>
                <pre className="text-xs text-gray-300 mt-2 whitespace-pre-wrap break-all">{selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : '—'}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}