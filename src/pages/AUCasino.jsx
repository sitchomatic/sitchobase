/**
 * AU Casino — focused launcher for Australian users running Joe Fortune and
 * Ignition Casino simultaneously through Browserbase.
 *
 * Why this page exists separately from FleetLauncher:
 *  - Both casinos require an AU residential proxy + AU mobile fingerprint to
 *    avoid bot-detection. Generic Fleet Launcher exposes those as toggles
 *    operators forget to set; here they're baked into the preset.
 *  - "Simultaneous" matters: free spin / promo windows often require the same
 *    user logged in to both within a few seconds. The dual-launch button kicks
 *    both sessions in parallel rather than sequentially.
 */
import { useCallback, useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import { auditLog } from '@/lib/auditLog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Loader2, Shield, Smartphone, Globe, Info } from 'lucide-react';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import AuCasinoTargetCard from '@/components/auCasino/AuCasinoTargetCard';
import {
  AU_CASINO_TARGETS, JOE_FORTUNE, IGNITION,
  AU_REGION, AU_MOBILE_USER_AGENT, buildAuCasinoSessionOptions,
} from '@/lib/auCasino';

const INITIAL_STATE = {
  [JOE_FORTUNE.key]: { status: 'idle' },
  [IGNITION.key]: { status: 'idle' },
};

export default function AUCasino() {
  const { isConfigured } = useCredentials();
  const [targetState, setTargetState] = useState(INITIAL_STATE);
  const [busy, setBusy] = useState(false);

  const launchOne = useCallback(async (target) => {
    setTargetState((prev) => ({ ...prev, [target.key]: { status: 'launching' } }));
    try {
      const options = buildAuCasinoSessionOptions(target);
      const session = await bbClient.createSession(options);
      setTargetState((prev) => ({
        ...prev,
        [target.key]: { status: 'ready', session },
      }));
      auditLog({
        action: 'AU_CASINO_LAUNCH',
        category: 'session',
        targetId: session?.id,
        details: { target: target.key, region: AU_REGION, mode: 'single' },
      });
      return session;
    } catch (err) {
      const message = err?.message || 'Failed to launch';
      setTargetState((prev) => ({ ...prev, [target.key]: { status: 'error', error: message } }));
      auditLog({
        action: 'AU_CASINO_LAUNCH',
        category: 'session',
        status: 'failure',
        details: { target: target.key, error: message },
      });
      throw err;
    }
  }, []);

  const launchBoth = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setTargetState({
      [JOE_FORTUNE.key]: { status: 'launching' },
      [IGNITION.key]: { status: 'launching' },
    });
    const results = await Promise.allSettled(AU_CASINO_TARGETS.map((t) => launchOne(t)));
    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    if (okCount === 2) toast.success('Both AU casino sessions launched');
    else if (okCount === 1) toast.warning(`Only ${okCount} of 2 sessions launched — check failed card`);
    else toast.error('Both AU casino launches failed');
    auditLog({
      action: 'AU_CASINO_DUAL_LAUNCH',
      category: 'session',
      status: okCount === 2 ? 'success' : 'failure',
      details: { successCount: okCount, totalCount: 2 },
    });
    setBusy(false);
  }, [busy, launchOne]);

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> AU Casino Dual Launch
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Spin up Joe Fortune and Ignition simultaneously from an AU mobile fingerprint with residential proxy.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 gap-1 capitalize">
            <Globe className="w-3 h-3" /> {AU_REGION}
          </Badge>
          <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 gap-1">
            <Smartphone className="w-3 h-3" /> AU Mobile
          </Badge>
          <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 gap-1">
            <Shield className="w-3 h-3" /> Residential Proxy
          </Badge>
        </div>
      </div>

      {/* Dual launcher */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-amber-500/5 via-gray-900 to-red-500/5 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-bold text-white">Launch both at once</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Promo windows often require parallel logins — this kicks both Browserbase sessions in parallel.
          </div>
        </div>
        <Button onClick={launchBoth} disabled={busy}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold gap-2 px-6 h-11 shadow-lg shadow-emerald-500/20">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {busy ? 'Launching both…' : 'Launch Joe + Ignition'}
        </Button>
      </div>

      {/* Per-target cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AU_CASINO_TARGETS.map((target) => (
          <AuCasinoTargetCard
            key={target.key}
            target={target}
            state={targetState[target.key]}
            onLaunch={launchOne}
          />
        ))}
      </div>

      {/* Preset details */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-gray-300 font-semibold">
          <Info className="w-3.5 h-3.5 text-cyan-400" /> Why these defaults?
        </div>
        <ul className="space-y-1.5 text-gray-500 list-disc list-inside">
          <li><span className="text-gray-300">Region {AU_REGION}</span> — closest Browserbase region to AU; avoids US-routed latency tells.</li>
          <li><span className="text-gray-300">AU residential proxy</span> — both casinos block datacenter IPs and most AU users browse via mobile carrier IPs.</li>
          <li><span className="text-gray-300">AU mobile fingerprint</span> — Pixel 8 / en-AU locale; both sites redirect mobile UAs to the lighter mobile site that has fewer bot challenges.</li>
          <li><span className="text-gray-300">Keep-alive on</span> — lets you re-attach to the session after closing the browser tab so promo timers don't expire.</li>
        </ul>
        <div className="text-gray-600 font-mono text-[11px] truncate">
          UA · {AU_MOBILE_USER_AGENT}
        </div>
      </div>
    </div>
  );
}