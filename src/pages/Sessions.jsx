import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient, formatBytes, formatDuration, estimateCost, formatCost } from '@/lib/bbClient';
import StatusBadge from '@/components/shared/StatusBadge';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import SessionDetailPanel from '@/components/sessions/SessionDetailPanel';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, Eye, CheckSquare, Square, XCircle, Archive, Trash2, Loader2, X, LayoutGrid, List } from 'lucide-react';
import CopyButton from '@/components/shared/CopyButton';
import { undoToast } from '@/lib/undoToast';
import { getJson, setBoundedJson } from '@/lib/boundedStorage';
import SessionCardGrid from '@/components/sessions/SessionCardGrid';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition, slideInVariants } from '@/lib/motion';

const ARCHIVED_KEY = 'bb_archived_sessions';

function getArchived() {
  return new Set(getJson(ARCHIVED_KEY, []));
}
function saveArchived(set) {
  setBoundedJson(ARCHIVED_KEY, [...set], 500);
}

export default function Sessions() {
  const { isConfigured } = useCredentials();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: sessionId } = useParams();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [archived, setArchived] = useState(getArchived);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('bb_sessions_view') || 'list');

  useEffect(() => { localStorage.setItem('bb_sessions_view', viewMode); }, [viewMode]);

  const { data: sessions = [], isFetching: loading, refetch } = useQuery({
    queryKey: ['sessions', filter, isConfigured],
    queryFn: () => bbClient.listSessions(filter === 'ALL' ? null : filter),
    enabled: isConfigured,
    initialData: [],
  });

  const cancelMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => bbClient.updateSession(id, { status: 'REQUEST_RELEASE' }))),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      const snapshots = queryClient.getQueriesData({ queryKey: ['sessions'] });
      snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, Array.isArray(data) ? data.map(session =>
          ids.includes(session.id) && (session.status === 'RUNNING' || session.status === 'PENDING')
            ? { ...session, status: 'PENDING' }
            : session
        ) : data);
      });
      return { snapshots };
    },
    onError: (_error, _ids, context) => {
      context?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    }
  });

  const load = useCallback(async () => {
    if (!isConfigured) return;
    await refetch();
  }, [isConfigured, refetch]);

  useEffect(() => {
    if (!isConfigured) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, isConfigured]);

  // #38 Memoize the filter so a 500-session list doesn't re-filter on every keystroke
  const filtered = useMemo(() => sessions.filter(s =>
    (!search || s.id.toLowerCase().includes(search.toLowerCase()) || (s.region && s.region.includes(search))) &&
    !archived.has(s.id)
  ), [sessions, search, archived]);

  const selectedSession = useMemo(
    () => filtered.find(s => s.id === sessionId) || sessions.find(s => s.id === sessionId) || null,
    [filtered, sessions, sessionId]
  );

  if (!isConfigured) return <CredentialsGuard />;

  const allChecked = filtered.length > 0 && filtered.every(s => checkedIds.has(s.id));
  const someChecked = checkedIds.size > 0;

  const toggleCheck = (id, e) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set(filtered.map(s => s.id)));
  };

  const clearSelection = () => setCheckedIds(new Set());

  const bulkCancel = async () => {
    const ids = [...checkedIds].filter(id => {
      const s = sessions.find(x => x.id === id);
      return s && (s.status === 'RUNNING' || s.status === 'PENDING');
    });
    if (!ids.length) { toast.error('No running/pending sessions selected'); return; }
    setBulkLoading(true);
    await cancelMutation.mutateAsync(ids);
    toast.success(`Cancelled ${ids.length} session${ids.length !== 1 ? 's' : ''}`);
    auditLog({ action: 'SESSIONS_BULK_CANCELLED', category: 'session', details: { count: ids.length, total: ids.length } });
    clearSelection();
    setBulkLoading(false);
  };

  const bulkArchive = () => {
    const ids = [...checkedIds];
    const prev = new Set(archived);
    const next = new Set(archived);
    ids.forEach(id => next.add(id));
    saveArchived(next);
    setArchived(next);
    if (selectedSession && ids.includes(selectedSession.id)) navigate('/sessions');
    // #43 Undo toast
    undoToast(`Archived ${ids.length} session${ids.length !== 1 ? 's' : ''}`, () => {
      saveArchived(prev);
      setArchived(prev);
      toast.info('Archive undone');
    });
    clearSelection();
  };

  const bulkDelete = async () => {
    const ids = [...checkedIds];
    setBulkLoading(true);
    // Try to release running sessions; then archive/hide all
    const runningIds = ids.filter(id => {
      const s = sessions.find(x => x.id === id);
      return s && (s.status === 'RUNNING' || s.status === 'PENDING');
    });
    if (runningIds.length) {
      await cancelMutation.mutateAsync(runningIds);
    }
    // Remove from local view by archiving
    const next = new Set(archived);
    ids.forEach(id => next.add(id));
    saveArchived(next);
    setArchived(next);
    if (selectedSession && ids.includes(selectedSession.id)) navigate('/sessions');
    toast.success(`Deleted ${ids.length} session${ids.length !== 1 ? 's' : ''} from view`);
    auditLog({ action: 'SESSIONS_BULK_DELETED', category: 'session', details: { count: ids.length } });
    clearSelection();
    setBulkLoading(false);
  };

  return (
    <PullToRefresh onRefresh={load}>
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800 space-y-3 bg-gray-900/60">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Live Sessions</h1>
              <p className="text-xs text-gray-500">{sessions.length} sessions · auto-refreshes every 10s</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-gray-700 overflow-hidden">
                <button onClick={() => setViewMode('list')}
                  className={`min-h-[44px] px-2.5 text-xs flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-gray-800 text-emerald-400' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button onClick={() => setViewMode('grid')}
                  className={`min-h-[44px] px-2.5 text-xs flex items-center gap-1.5 border-l border-gray-700 ${viewMode === 'grid' ? 'bg-gray-800 text-emerald-400' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Grid
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 min-h-[44px]">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <Input placeholder="Search by ID or region…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {['ALL','RUNNING','PENDING','COMPLETED','ERROR','TIMED_OUT'].map(s => (
                  <SelectItem key={s} value={s} className="text-gray-200">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk action bar */}
        {someChecked && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/20">
            <span className="text-xs text-emerald-300 font-medium flex-1">
              {checkedIds.size} selected
            </span>
            <Button size="sm" onClick={bulkCancel} disabled={bulkLoading}
              className="min-h-[36px] px-3 text-xs bg-yellow-600 hover:bg-yellow-700 text-white gap-1.5">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Cancel
            </Button>
            <Button size="sm" onClick={bulkArchive} disabled={bulkLoading}
              className="min-h-[36px] px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              <Archive className="w-3 h-3" /> Archive
            </Button>
            <Button size="sm" onClick={bulkDelete} disabled={bulkLoading}
              className="min-h-[36px] px-3 text-xs bg-red-700 hover:bg-red-800 text-white gap-1.5">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </Button>
            <button onClick={clearSelection} aria-label="Clear selection"
              className="min-h-[36px] min-w-[36px] text-gray-400 hover:text-white hover:bg-gray-800 rounded ml-1 inline-flex items-center justify-center transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Select-all header */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-800 bg-gray-900/40">
            <button onClick={toggleAll} className="min-h-[44px] flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              {allChecked
                ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                : <Square className="w-3.5 h-3.5" />}
              Select all
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${viewMode === 'list' ? 'divide-y divide-gray-800/60' : ''}`}>
          {loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-sm gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading sessions…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-sm gap-2">
              <Search className="w-6 h-6 opacity-40" />
              {search || filter !== 'ALL' ? 'No sessions match your filters' : 'No sessions yet'}
            </div>
          )}
          {viewMode === 'grid' && filtered.length > 0 && (
            <SessionCardGrid
              sessions={filtered}
              selectedId={selectedSession?.id}
              checkedIds={checkedIds}
              onToggleCheck={(id) => setCheckedIds(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })}
              onOpen={(id) => navigate(`/sessions/${id}`)}
            />
          )}
          {viewMode === 'list' && filtered.map(s => (
            <div key={s.id}
              onClick={() => navigate(`/sessions/${s.id}`)}
              className={`flex min-h-[44px] items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                selectedSession?.id === s.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                } ${checkedIds.has(s.id) ? 'bg-emerald-500/5' : ''}`}>
              {/* Checkbox */}
              <button onClick={e => toggleCheck(s.id, e)}
                className="min-h-[44px] min-w-[44px] flex-shrink-0 text-gray-500 hover:text-emerald-400 transition-colors inline-flex items-center justify-center">
                {checkedIds.has(s.id)
                  ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                  : <Square className="w-4 h-4" />}
              </button>
              <StatusBadge status={s.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-xs font-mono text-gray-200 truncate">{s.id}</div>
                  <CopyButton text={s.id} label="Session ID" />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{s.region}</span>
                  <span>·</span>
                  <span>{formatBytes(s.proxyBytes)} proxy</span>
                  {s.keepAlive && <span className="text-emerald-500">· Keep Alive</span>}
                  {s.startedAt && <span>· {formatDuration(s.startedAt, s.endedAt)}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(s.createdAt))} ago</div>
                <div className="text-xs text-yellow-500/80 font-mono mt-0.5">{formatCost(estimateCost(s.startedAt, s.endedAt))}</div>
                {s.contextId && <div className="text-xs text-purple-400 mt-0.5">Context</div>}
              </div>
              <Eye className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedSession && (
          <motion.div
            key={selectedSession.id}
            {...slideInVariants()}
            transition={pageTransition()}
          >
            <SessionDetailPanel session={selectedSession} onClose={() => navigate(-1)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PullToRefresh>
  );
}