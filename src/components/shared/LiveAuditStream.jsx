import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { installLiveNetworkLogger } from '@/lib/liveNetworkLogger';
import LiveTerminalControls from '@/components/shared/LiveTerminalControls';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Database, MousePointer, Navigation, Send, Terminal } from 'lucide-react';

const MAX_EVENTS = 120;
const MAX_TERMINAL_LOGS = 200;

function targetLabel(target) {
  if (!target) return 'unknown target';
  const el = target.closest?.('button,a,input,select,textarea,[role="button"],form') || target;
  const tag = el.tagName?.toLowerCase() || 'element';
  const text = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.innerText || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const id = el.id ? `#${el.id}` : '';
  return [tag + id, text].filter(Boolean).join(' · ');
}

function eventIcon(type) {
  if (type === 'error') return AlertTriangle;
  if (type === 'audit') return Database;
  if (type === 'route') return Navigation;
  if (type === 'submit') return Send;
  if (type === 'request' || type === 'response' || type === 'retry') return Terminal;
  return MousePointer;
}

function eventColor(type) {
  if (type === 'error') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (type === 'audit') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (type === 'route') return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
  if (type === 'request') return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
  if (type === 'response') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (type === 'retry') return 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
  return 'text-gray-300 border-gray-700 bg-gray-800/80';
}

export default function LiveAuditStream() {
  const location = useLocation();
  const [open, setOpen] = useState(() => localStorage.getItem('live_audit_open') === '1');
  const [mode, setMode] = useState(() => localStorage.getItem('live_audit_mode') || 'audit');
  const [events, setEvents] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [paused, setPaused] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const lastPathRef = useRef('');
  const pausedRef = useRef(false);

  const addEvent = (entry) => {
    if (pausedRef.current) return;
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    };
    setEvents((prev) => [item, ...prev].slice(0, MAX_EVENTS));
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const clearLogs = () => {
    if (mode === 'terminal') setTerminalLogs([]);
    else setEvents([]);
  };

  const exportLogs = () => {
    const data = mode === 'terminal' ? terminalLogs : events;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-${mode}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    localStorage.setItem('live_audit_open', open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    localStorage.setItem('live_audit_mode', mode);
  }, [mode]);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (lastPathRef.current && lastPathRef.current !== path) {
      addEvent({ type: 'route', action: 'NAVIGATED', details: `${lastPathRef.current} → ${path}` });
    } else if (!lastPathRef.current) {
      addEvent({ type: 'route', action: 'PAGE_OPENED', details: path });
    }
    lastPathRef.current = path;
  }, [location.pathname, location.search]);

  useEffect(() => {
    installLiveNetworkLogger();
    const onClick = (event) => addEvent({ type: 'click', action: 'CLICK', details: targetLabel(event.target) });
    const onSubmit = (event) => addEvent({ type: 'submit', action: 'FORM_SUBMIT', details: targetLabel(event.target) });
    const onError = (event) => addEvent({ type: 'error', action: 'FRONTEND_ERROR', details: event.message || 'Unknown error' });
    const onRejection = (event) => addEvent({ type: 'error', action: 'PROMISE_REJECTION', details: String(event.reason?.message || event.reason || 'Unknown rejection').slice(0, 160) });
    const onAudit = (event) => addEvent({ type: 'audit', action: event.detail?.action || 'AUDIT_LOG', details: event.detail?.category || '' });
    const onTerminal = (event) => {
      if (pausedRef.current) return;
      const entry = event.detail || {};
      setTerminalLogs((prev) => [entry, ...prev].slice(0, MAX_TERMINAL_LOGS));
      addEvent({ type: entry.type || 'request', action: `${entry.direction || 'LOG'} ${entry.action || ''}`.trim(), details: entry.source || 'terminal' });
    };

    window.addEventListener('click', onClick, true);
    window.addEventListener('submit', onSubmit, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('app-audit-log', onAudit);
    window.addEventListener('app-terminal-log', onTerminal);

    const unsubscribe = base44.entities.AuditLog.subscribe((event) => {
      if (event.type === 'create') {
        addEvent({
          type: 'audit',
          action: event.data?.action || 'AUDIT_CREATED',
          details: event.data?.category || event.data?.actor || '',
        });
      }
    });

    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('app-audit-log', onAudit);
      window.removeEventListener('app-terminal-log', onTerminal);
      unsubscribe?.();
    };
  }, []);

  const latest = mode === 'terminal' ? terminalLogs[0] : events[0];
  const visibleEvents = useMemo(() => events.slice(0, 60), [events]);
  const visibleTerminalLogs = useMemo(
    () => terminalLogs.filter((l) => sourceFilter === 'all' || l.source === sourceFilter).slice(0, 80),
    [terminalLogs, sourceFilter]
  );

  return (
    <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-50 md:bottom-4 md:right-4 w-[calc(100vw-1.5rem)] max-w-md pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-gray-800 bg-gray-950/95 shadow-2xl shadow-black/40 backdrop-blur overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-900 transition-colors"
        >
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Live Terminal</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-gray-500 font-mono">{mode === 'terminal' ? terminalLogs.length : events.length}</span>
            </div>
            <div className="text-[11px] text-gray-500 truncate">{latest ? `${latest.direction ? `${latest.direction} ` : ''}${latest.action || latest.details || ''}` : 'Waiting for app events…'}</div>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
        </button>

        {open && (
          <div className="border-t border-gray-800">
            <div className="flex items-center gap-1 p-2 border-b border-gray-800 bg-gray-950">
              {[
                ['audit', 'Audit'],
                ['terminal', 'Terminal'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors',
                    mode === key ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  )}
                >
                  {label}
                </button>
              ))}
              {paused && <span className="ml-auto text-[10px] font-mono text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30">PAUSED</span>}
            </div>
            {mode === 'terminal' && (
              <LiveTerminalControls
                paused={paused}
                onTogglePause={togglePause}
                onClear={clearLogs}
                onExport={exportLogs}
                sourceFilter={sourceFilter}
                onSourceFilter={setSourceFilter}
                count={visibleTerminalLogs.length}
              />
            )}

            {mode === 'terminal' ? (
              <div className="max-h-96 overflow-y-auto bg-black p-2 space-y-2 font-mono">
                {visibleTerminalLogs.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-gray-600">No network traffic captured yet</div>
                ) : visibleTerminalLogs.map((event) => (
                  <div key={event.id} className="rounded-lg border border-gray-800 bg-gray-950 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={cn('font-bold', event.direction === 'IN' ? 'text-emerald-300' : event.direction === 'ERR' ? 'text-red-300' : 'text-cyan-300')}>
                        [{event.direction || 'LOG'}] {event.source || 'app'}
                      </span>
                      <span className="text-gray-600">{new Date(event.at).toLocaleTimeString()} · {event.durationMs != null ? `${event.durationMs}ms` : 'live'}</span>
                    </div>
                    <div className="text-[11px] text-gray-200 mt-1 break-all">$ {event.action}</div>
                    {event.payload !== undefined && (
                      <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-gray-900/80 p-2 text-[10px] leading-relaxed text-gray-400 whitespace-pre-wrap">
                        {typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                {visibleEvents.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-gray-600">No events captured yet</div>
                ) : visibleEvents.map((event) => {
                  const Icon = eventIcon(event.type);
                  return (
                    <div key={event.id} className="rounded-xl border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        <div className={cn('mt-0.5 h-6 w-6 rounded-lg border flex items-center justify-center flex-shrink-0', eventColor(event.type))}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-gray-200 truncate">{event.action}</span>
                            <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">{new Date(event.at).toLocaleTimeString()}</span>
                          </div>
                          {event.details && <div className="text-[11px] text-gray-500 truncate mt-0.5">{event.details}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}