/**
 * AuCasinoTargetCard — single-target launch card showing live status of a
 * just-launched Browserbase session and a deep link to the Session Replay.
 * Stateless: parent owns sessionState and triggers (re)launch.
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Film, RefreshCw, ExternalLink, AlertCircle, CheckCircle, Globe } from 'lucide-react';
import { sessionInspectorUrl } from '@/lib/browserbaseUrls';

const BRAND_STYLES = {
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-300',
    button: 'bg-amber-500 hover:bg-amber-400 text-black',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  red: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    text: 'text-red-300',
    button: 'bg-red-500 hover:bg-red-400 text-black',
    chip: 'bg-red-500/10 text-red-300 border-red-500/30',
  },
};

export default function AuCasinoTargetCard({ target, state, onLaunch }) {
  const styles = BRAND_STYLES[target.brandColor] || BRAND_STYLES.amber;
  const status = state?.status || 'idle'; // idle | launching | ready | error
  const session = state?.session;
  const error = state?.error;
  const replayUrl = session?.id ? sessionInspectorUrl(session.id) : null;

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-base font-bold ${styles.text}`}>{target.label}</div>
          <a href={target.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-300 inline-flex items-center gap-1 truncate">
            <Globe className="w-3 h-3" /> {target.url.replace('https://', '')}
          </a>
        </div>
        {status === 'ready' && (
          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 gap-1">
            <CheckCircle className="w-3 h-3" /> Live
          </Badge>
        )}
        {status === 'error' && (
          <Badge className="bg-red-500/10 text-red-300 border-red-500/30 gap-1">
            <AlertCircle className="w-3 h-3" /> Failed
          </Badge>
        )}
        {status === 'launching' && (
          <Badge className="bg-yellow-500/10 text-yellow-300 border-yellow-500/30 gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Launching
          </Badge>
        )}
      </div>

      {session && (
        <div className="bg-gray-900/60 rounded-lg p-3 space-y-1.5 border border-gray-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Session ID</span>
            <code className="text-gray-300 font-mono truncate max-w-[180px]">{session.id}</code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Region</span>
            <span className="text-gray-300">{session.region || 'ap-southeast-1'}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={() => onLaunch(target)} disabled={status === 'launching'}
          className={`w-full ${styles.button} font-bold gap-2 disabled:opacity-50`}>
          {status === 'launching' ? <Loader2 className="w-4 h-4 animate-spin" />
            : status === 'ready' ? <RefreshCw className="w-4 h-4" />
            : <Play className="w-4 h-4" />}
          {status === 'launching' ? 'Launching…' : status === 'ready' ? 'Re-launch' : `Launch ${target.label}`}
        </Button>

        {replayUrl && (
          <div className="grid grid-cols-2 gap-2">
            <a href={replayUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full border-purple-500/30 text-purple-300 bg-purple-500/5 hover:bg-purple-500/10 gap-1.5 text-xs">
                <Film className="w-3 h-3" /> Replay
              </Button>
            </a>
            {session?.connectUrl && (
              <a href={session.connectUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 text-xs">
                  <ExternalLink className="w-3 h-3" /> Open
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}