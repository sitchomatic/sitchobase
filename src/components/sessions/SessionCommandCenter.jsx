import { useState, useEffect, useRef, useCallback } from 'react';
import { bbClient } from '@/lib/bbClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity, MousePointer2, Keyboard, Camera, Globe, AlertCircle,
  CheckCircle, Clock, RefreshCw, Pause, Play, Filter, Trash2, ArrowDown
} from 'lucide-react';

const EVENT_TYPES = {
  mouse:      { color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: MousePointer2 },
  keyboard:   { color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: Keyboard      },
  screenshot: { color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: Camera        },
  network:    { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: Globe         },
  error:      { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: AlertCircle   },
  system:     { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle   },
};

function classifyLog(log) {
  const s = typeof log === 'string' ? log : JSON.stringify(log);
  const sl = s.toLowerCase();
  if (sl.includes('mouse') || sl.includes('click') || sl.includes('move')) return 'mouse';
  if (sl.includes('key') || sl.includes('type') || sl.includes('input')) return 'keyboard';
  if (sl.includes('screenshot') || sl.includes('snapshot')) return 'screenshot';
  if (sl.includes('http') || sl.includes('fetch') || sl.includes('navigate') || sl.includes('url')) return 'network';
  if (sl.includes('error') || sl.includes('fail') || sl.includes('exception')) return 'error';
  return 'system';
}

function buildEntry(raw, source = 'log') {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
  const type = classifyLog(raw);
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    text,
    source,
    ts: new Date().toISOString(),
  };
}

function buildMetaEntry(meta, prev) {
  const cmd = meta?.remoteCommand;
  if (!cmd) return null;
  try {
    const parsed = typeof cmd === 'string' ? JSON.parse(cmd) : cmd;
    if (prev?.rawCmd === cmd) return null; // No change
    return {
      id: `meta-${parsed.ts || Date.now()}`,
      type: parsed.command === 'screenshot' ? 'screenshot' : parsed.command?.startsWith('mouse') ? 'mouse' : parsed.command?.startsWith('key') || parsed.command === 'type' ? 'keyboard' : 'system',
      text: `[Remote CMD] ${parsed.command}${parsed.params ? ' ' + JSON.stringify(parsed.params) : ''}`,
      source: 'metadata',
      ts: new Date(parsed.ts || Date.now()).toISOString(),
      rawCmd: cmd,
    };
  } catch {
    return null;
  }
}

export default function SessionCommandCenter({ session }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const lastMetaCmdRef = useRef(null);
  const logBottomRef = useRef(null);
  const knownLogCountRef = useRef(0);
  const intervalRef = useRef(null);

  const addEvents = useCallback((newEntries) => {
    if (newEntries.length === 0) return;
    setEvents(prev => {
      const combined = [...prev, ...newEntries];
      // Keep max 500
      return combined.slice(-500);
    });
  }, []);

  const poll = useCallback(async () => {
    if (paused || session.status !== 'RUNNING') return;
    setLoading(true);
    try {
      const [sessionData, logsData] = await Promise.allSettled([
        bbClient.getSession(session.id),
        bbClient.getSessionLogs(session.id),
      ]);

      const fresh = [];

      // Check metadata for remote commands broadcast by control panel
      if (sessionData.status === 'fulfilled') {
        const meta = sessionData.value?.userMetadata;
        const metaEntry = buildMetaEntry(meta, { rawCmd: lastMetaCmdRef.current });
        if (metaEntry) {
          lastMetaCmdRef.current = meta?.remoteCommand;
          fresh.push(metaEntry);
        }
      }

      // Process new log entries (only append new ones)
      if (logsData.status === 'fulfilled') {
        const logs = Array.isArray(logsData.value) ? logsData.value : [];
        const newLogs = logs.slice(knownLogCountRef.current);
        knownLogCountRef.current = logs.length;
        newLogs.forEach(log => fresh.push(buildEntry(log, 'log')));
      }

      if (fresh.length > 0) addEvents(fresh);
      setPollCount(c => c + 1);
    } catch {
      // Silent — don't spam errors
    }
    setLoading(false);
  }, [paused, session.id, session.status, addEvents]);

  // Initial load
  useEffect(() => {
    setEvents([]);
    knownLogCountRef.current = 0;
    lastMetaCmdRef.current = null;
    poll();
  }, [session.id]);

  // Polling every 3s
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (session.status === 'RUNNING') {
      intervalRef.current = setInterval(poll, 3000);
    }
    return () => clearInterval(intervalRef.current);
  }, [poll, session.status]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logBottomRef.current) {
      logBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const visible = events.filter(e => {
    if (filter !== 'all' && e.type !== filter) return false;
    if (search && !e.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearEvents = () => { setEvents([]); knownLogCountRef.current = 0; };

  const notRunning = session.status !== 'RUNNING';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-950/40">

      {/* Toolbar */}
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 flex-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${notRunning ? 'bg-gray-600' : paused ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-xs font-mono text-gray-400">
              {notRunning ? 'SESSION INACTIVE' : paused ? 'PAUSED' : `LIVE · ${pollCount} polls`}
            </span>
          </div>
          <span className="text-xs text-gray-600">{visible.length} events</span>
          <Button size="sm" variant="ghost" onClick={poll} disabled={loading || notRunning}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-200">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPaused(p => !p)} disabled={notRunning}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-200">
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearEvents}
            className="h-6 w-6 p-0 text-gray-500 hover:text-red-400">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Filter events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-300 placeholder:text-gray-600"
        />

        {/* Type filters */}
        <div className="flex gap-1 flex-wrap">
          {['all', ...Object.keys(EVENT_TYPES)].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                filter === t
                  ? t === 'all'
                    ? 'bg-gray-600 text-white border-gray-500'
                    : `${EVENT_TYPES[t]?.bg} ${EVENT_TYPES[t]?.color} ${EVENT_TYPES[t]?.border}`
                  : 'border-gray-700 text-gray-600 hover:text-gray-400'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Event stream */}
      <div className="flex-1 overflow-y-auto font-mono text-xs relative"
        onScroll={e => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          setAutoScroll(atBottom);
        }}>

        {notRunning && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-600">
            <Activity className="w-8 h-8 opacity-30" />
            <span className="text-sm">Session is not running</span>
            <span className="text-xs">Status: {session.status}</span>
          </div>
        )}

        {!notRunning && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-600">
            <Activity className={`w-8 h-8 opacity-30 ${loading ? 'animate-pulse' : ''}`} />
            <span className="text-sm">{loading ? 'Fetching events…' : 'Waiting for events…'}</span>
            <span className="text-xs opacity-60">Polling every 3 seconds</span>
          </div>
        )}

        <div className="space-y-0">
          {visible.map((entry, idx) => {
            const cfg = EVENT_TYPES[entry.type] || EVENT_TYPES.system;
            const Icon = cfg.icon;
            const prev = visible[idx - 1];
            const showTime = !prev || new Date(entry.ts) - new Date(prev.ts) > 2000;

            return (
              <div key={entry.id}>
                {showTime && (
                  <div className="flex items-center gap-2 px-3 py-1">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-gray-700 text-xs flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                )}
                <div className={`flex items-start gap-2 px-3 py-1.5 hover:bg-gray-800/30 transition-colors border-l-2 ${entry.source === 'metadata' ? 'border-emerald-500/50' : 'border-transparent'}`}>
                  <Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`${cfg.color} font-semibold`}>[{entry.type}]</span>
                    {' '}
                    <span className="text-gray-300 break-all whitespace-pre-wrap">{entry.text}</span>
                    {entry.source === 'metadata' && (
                      <span className="ml-2 text-emerald-600 text-xs">← live</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={logBottomRef} />
        </div>
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && visible.length > 0 && (
        <button
          onClick={() => { setAutoScroll(true); logBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition-colors">
          <ArrowDown className="w-3 h-3" /> Latest
        </button>
      )}
    </div>
  );
}