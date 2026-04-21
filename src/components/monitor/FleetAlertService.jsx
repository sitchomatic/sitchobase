import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { detectFleetFailurePatterns, getFleetAlertSummary } from '@/components/monitor/fleetAlertUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STORAGE_KEY = 'bb_fleet_alerts';
const NOTIFICATION_KEY = 'bb_fleet_alert_notifications';

function saveAlerts(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function readFleetAlerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function readNotifiedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids) {
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify([...ids]));
}

function notifyDesktop(alert) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(alert.title, { body: alert.detail });
  }
}

export default function FleetAlertService({ sessions, logsBySession }) {
  const notifiedIdsRef = useRef(readNotifiedIds());
  const alerts = useMemo(() => detectFleetFailurePatterns(sessions, logsBySession), [sessions, logsBySession]);
  const summary = useMemo(() => getFleetAlertSummary(alerts), [alerts]);

  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    alerts.forEach((alert) => {
      if (notifiedIdsRef.current.has(alert.id)) return;
      toast.error(`${alert.title} — ${alert.detail}`);
      notifyDesktop(alert);
      notifiedIdsRef.current.add(alert.id);
    });
    saveNotifiedIds(notifiedIdsRef.current);
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle className="w-4 h-4 text-red-400" /> Fleet Alert Service
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/10 text-red-200 border-red-500/20">{summary.total} active</Badge>
          {summary.high > 0 && <Badge className="bg-red-600/20 text-red-200 border-red-500/20">{summary.high} high</Badge>}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-lg border border-red-500/20 bg-gray-950/40 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-red-200">{alert.title}</div>
              <Badge className={alert.severity === 'high' ? 'bg-red-600/20 text-red-200 border-red-500/20' : 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20'}>
                {alert.severity}
              </Badge>
            </div>
            <div className="text-xs text-red-100/80 mt-2">{alert.detail}</div>
            <div className="text-[11px] text-gray-400 mt-2">Affected sessions: {alert.sessionIds.length}</div>
          </div>
        ))}
      </div>
    </section>
  );
}