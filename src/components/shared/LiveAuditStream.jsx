import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Database, MousePointer, Navigation, Send } from 'lucide-react';

const MAX_EVENTS = 120;

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
  return MousePointer;
}

function eventColor(type) {
  if (type === 'error') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (type === 'audit') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (type === 'route') return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
  return 'text-gray-300 border-gray-700 bg-gray-800/80';
}

export default function LiveAuditStream() {
  const location = useLocation();
  const [open, setOpen] = useState(() => localStorage.getItem('live_audit_open') === '1');
  const [events, setEvents] = useState([]);
  const lastPathRef = useRef('');

  const addEvent = (entry) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    };
    setEvents((prev) => [item, ...prev].slice(0, MAX_EVENTS));
  };

  useEffect(() => {
    localStorage.setItem('live_audit_open', open ? '1' : '0');
  }, [open]);

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
    const onClick = (event) => addEvent({ type: 'click', action: 'CLICK', details: targetLabel(event.target) });
    const onSubmit = (event) => addEvent({ type: 'submit', action: 'FORM_SUBMIT', details: targetLabel(event.target) });
    const onError = (event) => addEvent({ type: 'error', action: 'FRONTEND_ERROR', details: event.message || 'Unknown error' });
    const onRejection = (event) => addEvent({ type: 'error', action: 'PROMISE_REJECTION', details: String(event.reason?.message || event.reason || 'Unknown rejection').slice(0, 160) });
    const onAudit = (event) => addEvent({ type: 'audit', action: event.detail?.action || 'AUDIT_LOG', details: event.detail?.category || '' });

    window.addEventListener('click', onClick, true);
    window.addEventListener('submit', onSubmit, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('app-audit-log', onAudit);

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
      unsubscribe?.();
    };
  }, []);

  const latest = events[0];
  const visibleEvents = useMemo(() => events.slice(0, 60), [events]);

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
              <span className="text-xs font-bold text-white uppercase tracking-wider">Live Audit</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-gray-500 font-mono">{events.length}</span>
            </div>
            <div className="text-[11px] text-gray-500 truncate">{latest ? `${latest.action} · ${latest.details}` : 'Waiting for app events…'}</div>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
        </button>

        {open && (
          <div className="border-t border-gray-800 max-h-80 overflow-y-auto p-2 space-y-1.5">
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
    </div>
  );
}