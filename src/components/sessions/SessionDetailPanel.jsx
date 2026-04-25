import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { bbClient, formatBytes } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import StatusBadge from '@/components/shared/StatusBadge';
import SessionRecordingPlayer from '@/components/sessions/SessionRecordingPlayer';
import SessionFailureReplay from '@/components/sessions/SessionFailureReplay';
import SessionControlPanel from '@/components/sessions/SessionControlPanel';
import SessionCommandCenter from '@/components/sessions/SessionCommandCenter';
import SessionScreenshotsGallery from '@/components/sessions/SessionScreenshotsGallery';
import SessionCDPPanel from '@/components/sessions/SessionCDPPanel';
import SessionNetworkInspector from '@/components/sessions/SessionNetworkInspector';
import SessionTabsPanel from '@/components/sessions/SessionTabsPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, ChevronLeft, ExternalLink, RefreshCw, Terminal, Film, Info, Gamepad2, Radio, ImageIcon, Cpu, Network, Layers2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SessionDetailPanel({ session, onClose }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(session);
  const [logs, setLogs] = useState([]);
  const [recording, setRecording] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [d, l, r, e] = await Promise.allSettled([
      bbClient.getSession(session.id),
      bbClient.getSessionLogs(session.id),
      bbClient.getSessionRecording(session.id),
      base44.entities.AutomationEvidence.filter({ browserbaseSessionId: session.id }),
    ]);
    if (d.status === 'fulfilled') setDetail(d.value);
    if (l.status === 'fulfilled') setLogs(Array.isArray(l.value) ? l.value : []);
    if (r.status === 'fulfilled') setRecording(r.value);
    if (e.status === 'fulfilled') setEvidence(e.value?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [session.id]);

  return (
    <div className="fixed md:static inset-0 md:inset-auto z-30 w-full md:w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 min-w-0">
          {isMobile && (
            <Button size="icon" variant="ghost" onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white md:hidden min-h-[44px] min-w-[44px]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <StatusBadge status={detail.status} />
          <span className="text-xs font-mono text-gray-400 truncate max-w-[160px]">{detail.id}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={refresh} disabled={loading}
            className="text-gray-500 hover:text-gray-200 min-h-[44px] min-w-[44px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose}
            className="text-gray-500 hover:text-gray-200 min-h-[44px] min-w-[44px]">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-4 py-2 bg-transparent border-b border-gray-800 rounded-none justify-start gap-1 h-auto flex-wrap">
          {[['info','Info',Info],['logs','Logs',Terminal],['recording','Replay',Film],['control','Control',Gamepad2],['cmd','Live',Radio],['shots','Shots',ImageIcon],['cdp','CDP',Cpu],['network','Network',Network],['tabs','Tabs',Layers2]].map(([val,label,Icon]) => (
            <TabsTrigger key={val} value={val}
              className="min-h-[44px] text-xs px-2.5 py-1 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 text-gray-500 rounded-md gap-1">
              <Icon className="w-3 h-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
          <InfoRow label="Session ID" value={detail.id} mono />
          <InfoRow label="Project ID" value={detail.projectId} mono />
          <InfoRow label="Status" value={<StatusBadge status={detail.status} />} />
          <InfoRow label="Region" value={detail.region} />
          <InfoRow label="Keep Alive" value={detail.keepAlive ? 'Yes' : 'No'} />
          <InfoRow label="Proxy Bytes" value={formatBytes(detail.proxyBytes)} />
          {detail.contextId && <InfoRow label="Context ID" value={detail.contextId} mono />}
          {detail.startedAt && <InfoRow label="Started" value={format(new Date(detail.startedAt), 'MMM d, HH:mm:ss')} />}
          {detail.endedAt && <InfoRow label="Ended" value={format(new Date(detail.endedAt), 'MMM d, HH:mm:ss')} />}
          {detail.expiresAt && <InfoRow label="Expires" value={format(new Date(detail.expiresAt), 'MMM d, HH:mm:ss')} />}

          {detail.connectUrl && (
            <div className="pt-2 border-t border-gray-800">
              <a href={detail.connectUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Open Connect URL
                </Button>
              </a>
            </div>
          )}

          {detail.userMetadata && Object.keys(detail.userMetadata).length > 0 && (
            <div className="pt-2 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-2">User Metadata</div>
              <pre className="text-xs bg-gray-800 rounded p-2 text-gray-300 overflow-auto">
                {JSON.stringify(detail.userMetadata, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-y-auto p-3 mt-0">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">No logs available</div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-400 bg-gray-800/50 rounded px-2 py-1">
                  {typeof log === 'string' ? log : JSON.stringify(log)}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recording" className="flex-1 overflow-y-auto p-4 mt-0 space-y-3">
          <SessionFailureReplay session={detail} logs={logs} />
          <SessionRecordingPlayer recording={recording} evidence={evidence} loading={loading} />
        </TabsContent>

        <TabsContent value="control" className="flex-1 overflow-y-auto mt-0">
          <SessionControlPanel session={detail} />
        </TabsContent>

        <TabsContent value="cmd" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SessionCommandCenter session={detail} />
        </TabsContent>

        <TabsContent value="shots" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SessionScreenshotsGallery session={detail} evidence={evidence} />
        </TabsContent>

        <TabsContent value="cdp" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SessionCDPPanel session={detail} />
        </TabsContent>

        <TabsContent value="network" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SessionNetworkInspector session={detail} />
        </TabsContent>

        <TabsContent value="tabs" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SessionTabsPanel session={detail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-gray-200 text-right truncate max-w-[200px] ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}