import { formatRatio, formatLatency, formatCostPerSuccess } from '@/lib/proxyEfficiency';

function ProviderBadge({ provider, proxyCount }) {
  const palette = {
    'bb-au':      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'none':       'bg-gray-700/40 text-gray-400 border-gray-700',
    'smartproxy': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'brightdata': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    'oxylabs':    'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  };
  const cls = palette[provider] || 'bg-gray-800 text-gray-300 border-gray-700';
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono border ${cls}`}>{provider}</span>
      {proxyCount > 0 && <span className="text-[10px] text-gray-600">· {proxyCount} in pool</span>}
    </div>
  );
}

function RateBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function ProxyEfficiencyTable({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 py-12 text-center text-sm text-gray-500">
        No Joe Ignite runs in the selected window yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-wide text-gray-500 border-b border-gray-800 bg-gray-900/80">
        <div>Provider</div>
        <div>Success Rate</div>
        <div>Success : Failure</div>
        <div>Runs</div>
        <div>Avg Latency</div>
        <div className="text-right">Cost / Success</div>
      </div>
      {rows.map((r) => (
        <div key={r.provider}
          className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-3 text-sm border-b border-gray-800/60 last:border-b-0 hover:bg-gray-800/40 transition-colors items-center">
          <ProviderBadge provider={r.provider} proxyCount={r.proxyCount} />
          <RateBar value={r.successRate} />
          <div className="font-mono text-gray-300">
            <span className="text-emerald-400">{r.success}</span>
            <span className="text-gray-600"> : </span>
            <span className="text-red-400">{r.failure}</span>
            <span className="text-gray-600 ml-2 text-xs">({formatRatio(r.ratio)})</span>
          </div>
          <div className="font-mono text-gray-300">{r.total.toLocaleString()}</div>
          <div className="font-mono text-gray-300">{formatLatency(r.avgLatencySec)}</div>
          <div className="font-mono text-gray-300 text-right">
            {formatCostPerSuccess(r.costPerSuccess)}
            <div className="text-[10px] text-gray-600">${r.costUsd.toFixed(2)} total</div>
          </div>
        </div>
      ))}
    </div>
  );
}