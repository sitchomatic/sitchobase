import { Copy, Server, ShieldCheck, Activity, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function copy(text, label) {
  navigator.clipboard.writeText(text || '');
  toast.success(`${label} copied`);
}

export default function NordLynxResult({ result }) {
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
        <Activity className="w-5 h-5 text-emerald-400 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-white">NordLynx Validation Passed</div>
          <div className="text-xs text-gray-400 mt-1">WireGuard keys, endpoint, server load, Docker healthcheck, SOCKS5 bridge, and fail-closed egress rules were generated successfully.</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {(result.hardening || []).map((item) => (
              <span key={item} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
          <div className="text-xs text-gray-400">SOCKS5 Browser Proxy</div>
          <div className="text-sm font-mono text-white mt-1">{result.socksProxyUrl}</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <Server className="w-5 h-5 text-cyan-400 mb-2" />
          <div className="text-xs text-gray-400">Selected Server</div>
          <div className="text-sm text-white mt-1 truncate">{result.server?.hostname || result.server?.name}</div>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="text-2xl font-black text-yellow-300 font-mono">{result.server?.load ?? '—'}%</div>
          <div className="text-xs text-gray-400">Server Load</div>
        </div>
      </div>

      <OutputBlock title="WireGuard Config" value={result.wireguardConfig} onCopy={() => copy(result.wireguardConfig, 'WireGuard config')} />
      <OutputBlock title="Docker Runtime Bundle" value={result.dockerBundle} onCopy={() => copy(result.dockerBundle, 'Docker bundle')} />
    </div>
  );
}

function OutputBlock({ title, value, onCopy }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="text-sm font-bold text-white">{title}</div>
        <Button variant="outline" size="sm" onClick={onCopy} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <Copy className="w-3 h-3" /> Copy
        </Button>
      </div>
      <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap font-mono">{value}</pre>
    </div>
  );
}