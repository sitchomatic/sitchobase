import { useState } from 'react';
import { Activity, Loader2, ShieldCheck, Wrench, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ProxyNetworkHealthPanel({ projectId, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runHeal = async (testLive) => {
    setLoading(true);
    const response = await base44.functions.invoke('proxyNetworkHeal', { projectId, testLive, limit: 12 });
    setLoading(false);
    if (response.data?.error) {
      toast.error(response.data.error);
      return;
    }
    setResult(response.data);
    onComplete?.();
    toast.success(testLive ? 'Live proxy test and healing complete' : 'Proxy repair pass complete');
  };

  const s = result?.summary;

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-gray-900 to-gray-900 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Live Network Healing</div>
            <div className="text-xs text-gray-400">Repairs proxy format issues, releases expired quarantines, and can run live Browserbase proxy checks.</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button disabled={loading} variant="outline" onClick={() => runHeal(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Repair Only
          </Button>
          <Button disabled={loading || !projectId} onClick={() => runHeal(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Live Test + Heal
          </Button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Mini label="Repaired" value={s.repaired} />
          <Mini label="Duplicates" value={s.duplicates} />
          <Mini label="Quarantined" value={s.quarantined} tone="warn" />
          <Mini label="Released" value={s.released} />
          <Mini label="Healthy" value={s.healthy} tone="good" />
          <Mini label="Failed" value={s.failed} tone="bad" />
        </div>
      )}

      {result?.tested?.some((t) => !t.ok) && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Failed proxies were degraded or quarantined automatically and removed from active rotation.
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, tone = 'neutral' }) {
  const cls = {
    neutral: 'border-gray-800 bg-gray-950 text-gray-200',
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warn: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    bad: 'border-red-500/30 bg-red-500/10 text-red-300',
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-lg font-black font-mono">{value ?? 0}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}