import { useState, useEffect, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { listSessions, formatBytes } from '@/lib/browserbaseApi';
import StatusBadge from '@/components/shared/StatusBadge';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import SessionDetailPanel from '@/components/sessions/SessionDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Sessions() {
  const { credentials, isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const statusFilter = filter === 'ALL' ? null : filter;
    const data = await listSessions(credentials.apiKey, statusFilter);
    setSessions(data);
    setLoading(false);
  }, [credentials, isConfigured, filter]);

  useEffect(() => { load(); }, [load]);

  if (!isConfigured) return <CredentialsGuard />;

  const filtered = sessions.filter(s =>
    !search || s.id.includes(search) || (s.region && s.region.includes(search))
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">Live Sessions</h1>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <Input
                placeholder="Search by ID or region…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8"
              />
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

        <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              {loading ? 'Loading sessions…' : 'No sessions found'}
            </div>
          )}
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                selected?.id === s.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'
              }`}
            >
              <StatusBadge status={s.status} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-gray-200 truncate">{s.id}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{s.region}</span>
                  <span>·</span>
                  <span>{formatBytes(s.proxyBytes)} proxy</span>
                  {s.keepAlive && <span className="text-emerald-500">· Keep Alive</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(s.createdAt))} ago</div>
                {s.contextId && <div className="text-xs text-purple-400 mt-0.5">Context</div>}
              </div>
              <Eye className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <SessionDetailPanel
          session={selected}
          credentials={credentials}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}