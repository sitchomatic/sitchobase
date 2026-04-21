import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/shared/PullToRefresh';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import SessionMonitorCard from '@/components/monitor/SessionMonitorCard';
import SessionExpandModal from '@/components/monitor/SessionExpandModal';
import AIOpsPanel from '@/components/monitor/AIOpsPanel';
import FleetAlertService from '@/components/monitor/FleetAlertService';
import { normalizeLogEntry, detectAnomalies, detectStuckSessions, groupFailures } from '@/components/monitor/monitorUtils';
import { buildAiOpsPrompt } from '@/components/monitor/buildAiOpsPrompt';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Wifi } from 'lucide-react';

export default function Monitor() {
  const { isConfigured } = useCredentials();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [logsBySession, setLogsBySession] = useState({});
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const data = await bbClient.listSessions('RUNNING');
    const nextSessions = Array.isArray(data) ? data : [];
    setSessions(nextSessions);

    const logResults = await Promise.allSettled(nextSessions.map((session) => bbClient.getSessionLogs(session.id)));
    const nextLogs = {};
    nextSessions.forEach((session, index) => {
      const result = logResults[index];
      const logs = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
      nextLogs[session.id] = logs.slice(-20).map((log, logIndex) => normalizeLogEntry(session.id, log, logIndex));
    });
    setLogsBySession(nextLogs);
    setLoading(false);
  }, [isConfigured]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isConfigured) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, isConfigured]);

  const failureGroups = useMemo(() => groupFailures(sessions, logsBySession), [sessions, logsBySession]);
  const stuckSessions = useMemo(() => detectStuckSessions(sessions, logsBySession), [sessions, logsBySession]);
  const anomalies = useMemo(() => detectAnomalies(sessions, logsBySession), [sessions, logsBySession]);

  const analyze = useCallback(async () => {
    setAiLoading(true);
    const prompt = buildAiOpsPrompt({ sessions, failureGroups, stuckSessions, anomalies });
    const report = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          groupedFailures: { type: 'array', items: { type: 'string' } },
          fixSuggestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['summary', 'groupedFailures', 'fixSuggestions']
      }
    });
    setAiReport(report);
    setAiLoading(false);
  }, [sessions, failureGroups, stuckSessions, anomalies]);

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <>
      <PullToRefresh onRefresh={load}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Real-Time Monitor</h1>
              <p className="text-xs text-gray-500">
                {sessions.length} running session{sessions.length !== 1 ? 's' : ''} · CDP streaming active · auto-refreshes every 15s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <FleetAlertService sessions={sessions} logsBySession={logsBySession} />
          <AIOpsPanel
            sessions={sessions}
            logsBySession={logsBySession}
            aiReport={aiReport}
            aiLoading={aiLoading}
            onRefreshAI={analyze}
          />

          {loading && sessions.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading running sessions…
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
                <Wifi className="w-7 h-7 text-gray-600" />
              </div>
              <div>
                <div className="text-gray-400 font-semibold">No running sessions</div>
                <div className="text-xs text-gray-600 mt-1">
                  Launch sessions from Fleet Launcher or Sessions page to see them here.
                </div>
              </div>
              <Button size="sm" onClick={load} variant="outline"
                className="border-gray-700 text-gray-400 hover:bg-gray-800 gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Check again
              </Button>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sessions.map(s => (
                <SessionMonitorCard
                  key={s.id}
                  session={s}
                  onExpand={setExpanded}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </PullToRefresh>

      {expanded && (
        <SessionExpandModal session={expanded} onClose={() => setExpanded(null)} />
      )}
    </>
  );
}