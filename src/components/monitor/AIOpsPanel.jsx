import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Brain, Clock3, RefreshCw, Sparkles } from 'lucide-react';
import { buildTimelineItems, detectAnomalies, detectStuckSessions, groupFailures } from '@/components/monitor/monitorUtils';

export default function AIOpsPanel({ sessions, logsBySession, aiReport, aiLoading, onRefreshAI }) {
  const timeline = useMemo(() => buildTimelineItems(sessions, logsBySession).slice(0, 40), [sessions, logsBySession]);
  const stuckSessions = useMemo(() => detectStuckSessions(sessions, logsBySession), [sessions, logsBySession]);
  const anomalies = useMemo(() => detectAnomalies(sessions, logsBySession), [sessions, logsBySession]);
  const failureGroups = useMemo(() => groupFailures(sessions, logsBySession), [sessions, logsBySession]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-5">
      <section className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-2 text-white text-sm font-semibold">
            <Clock3 className="w-4 h-4 text-cyan-400" /> Unified Timeline
          </div>
          <div className="text-xs text-gray-500">{timeline.length} recent events</div>
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2">
          {timeline.length === 0 ? <div className="text-xs text-gray-600">No events yet</div> : timeline.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-mono text-gray-300 truncate">{item.sessionId}</div>
                <div className="text-[11px] text-gray-600">{new Date(item.ts).toLocaleTimeString()}</div>
              </div>
              <div className={`text-xs mt-1 ${item.level === 'error' ? 'text-red-400' : item.level === 'warn' ? 'text-yellow-400' : 'text-gray-400'}`}>{item.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 text-white text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> Alerts
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2">
          {stuckSessions.length === 0 && anomalies.length === 0 ? <div className="text-xs text-gray-600">No alerts detected</div> : null}
          {stuckSessions.map(({ session, idleMinutes }) => (
            <div key={session.id} className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2">
              <div className="text-xs text-orange-300 font-medium">Potentially stuck session</div>
              <div className="text-xs text-orange-200 mt-1 font-mono truncate">{session.id}</div>
              <div className="text-[11px] text-orange-300/80 mt-1">No fresh activity for {idleMinutes} min</div>
            </div>
          ))}
          {anomalies.map((item) => (
            <div key={item.id} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <div className="text-xs text-red-300 font-medium">{item.title}</div>
              <div className="text-xs text-red-200 mt-1 font-mono truncate">{item.sessionId}</div>
              <div className="text-[11px] text-red-300/80 mt-1">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-white text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" /> AI Root Cause
          </div>
          <Button size="sm" variant="outline" onClick={onRefreshAI} disabled={aiLoading} className="h-7 border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} /> Analyze
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-2">Failure Groups</div>
            <div className="space-y-2">
              {failureGroups.length === 0 ? <div className="text-xs text-gray-600">No grouped failures yet</div> : failureGroups.map((group) => (
                <div key={group.key} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                  <div className="text-xs text-white font-medium">{group.key} · {group.count}</div>
                  {group.samples.map((sample) => (
                    <div key={sample.sessionId} className="text-[11px] text-gray-500 mt-1 truncate">{sample.sessionId}: {sample.message}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-purple-400" /> AI Summary</div>
            {!aiReport ? <div className="text-xs text-gray-600">Run Analyze to generate a short summary and fix suggestions.</div> : (
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                  <div className="text-xs text-white font-medium mb-1">Short Summary</div>
                  <div className="text-xs text-gray-400">{aiReport.summary}</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                  <div className="text-xs text-white font-medium mb-1">Fix Suggestions</div>
                  <ul className="space-y-1 list-disc list-inside text-xs text-gray-400">
                    {(aiReport.fixSuggestions || []).map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}