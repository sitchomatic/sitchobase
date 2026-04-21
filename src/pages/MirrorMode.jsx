import { useState, useCallback } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { listSessions } from '@/lib/browserbaseApi';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Send, Loader2, RefreshCw, CheckCircle, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';

const ACTIONS = [
  { label: 'Navigate', icon: Globe, type: 'navigate' },
  { label: 'Click', icon: Zap, type: 'click' },
  { label: 'Type Text', icon: Send, type: 'type' },
  { label: 'Screenshot', icon: Eye, type: 'screenshot' },
];

export default function MirrorMode() {
  const { credentials, isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [masterUrl, setMasterUrl] = useState('');
  const [actionType, setActionType] = useState('navigate');
  const [selector, setSelector] = useState('');
  const [textInput, setTextInput] = useState('');
  const [broadcastLog, setBroadcastLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await listSessions(credentials.apiKey, 'RUNNING');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(`Failed to load sessions: ${err.message}`);
      setSessions([]);
    }
    setLoading(false);
  };

  const toggleSession = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sessions.map(s => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  const broadcast = async () => {
    if (selectedIds.size === 0) return;
    setBroadcasting(true);

    const command = {
      type: actionType,
      url: masterUrl,
      selector,
      text: textInput,
      timestamp: new Date().toISOString(),
    };

    // Simulate broadcast — in production each target would receive via WebSocket/CDP
    const results = [];
    for (const id of selectedIds) {
      // Simulate slight delay per session
      await new Promise(r => setTimeout(r, 80));
      results.push({ sessionId: id, status: 'broadcasted', command });
    }

    setBroadcastLog(prev => [
      {
        id: Date.now(),
        action: actionType,
        targets: selectedIds.size,
        payload: actionType === 'navigate' ? masterUrl : (selector || textInput),
        timestamp: new Date().toLocaleTimeString(),
        success: true,
      },
      ...prev.slice(0, 19),
    ]);

    setBroadcasting(false);
  };

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" /> Mirror Mode
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Broadcast commands to all selected sessions simultaneously</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadSessions} disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Load Running Sessions
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Session selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">Target Fleet</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={selectAll}
                className="text-xs text-emerald-400 hover:text-emerald-300 h-6 px-2">All</Button>
              <Button size="sm" variant="ghost" onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-300 h-6 px-2">Clear</Button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">
              Load running sessions to select targets
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleSession(s.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(s.id)
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-gray-800/50 border border-transparent hover:border-gray-700'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                    selectedIds.has(s.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                  }`}>
                    {selectedIds.has(s.id) && <CheckCircle className="w-2.5 h-2.5 text-black" />}
                  </div>
                  <span className="text-xs font-mono text-gray-300 truncate">{s.id.slice(0, 16)}…</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-emerald-400 font-medium">
              {selectedIds.size} sessions selected
            </div>
          )}
        </div>

        {/* Command panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="text-sm font-semibold text-white">Broadcast Command</div>

          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(({ label, icon: Icon, type }) => (
              <button
                key={type}
                onClick={() => setActionType(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  actionType === type
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {(actionType === 'navigate') && (
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Target URL</Label>
              <Input
                placeholder="https://example.com"
                value={masterUrl}
                onChange={e => setMasterUrl(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200 text-sm"
              />
            </div>
          )}
          {(actionType === 'click' || actionType === 'type') && (
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">CSS Selector</Label>
              <Input
                placeholder="#submit-btn or .form-input"
                value={selector}
                onChange={e => setSelector(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200 text-sm"
              />
            </div>
          )}
          {actionType === 'type' && (
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Text to Type</Label>
              <Input
                placeholder="Hello from Mirror Mode"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200 text-sm"
              />
            </div>
          )}

          <Button
            onClick={broadcast}
            disabled={broadcasting || selectedIds.size === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2"
          >
            {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Broadcast to {selectedIds.size} Sessions
          </Button>
        </div>

        {/* Broadcast log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold text-white mb-3">Broadcast Log</div>
          {broadcastLog.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">No broadcasts yet</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {broadcastLog.map(entry => (
                <div key={entry.id} className="bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-gray-600">{entry.timestamp}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{entry.payload || '—'}</div>
                  <div className="text-xs text-gray-600">→ {entry.targets} targets</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}