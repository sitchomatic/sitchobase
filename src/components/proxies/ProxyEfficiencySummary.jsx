import { TrendingUp, DollarSign, Clock, Target } from 'lucide-react';
import { formatLatency, formatCostPerSuccess } from '@/lib/proxyEfficiency';

function Card({ icon: Icon, label, value, sub, color }) {
  const c = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    cyan:    'border-cyan-500/30 bg-cyan-500/5 text-cyan-400',
    yellow:  'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    pink:    'border-pink-500/30 bg-pink-500/5 text-pink-400',
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-mono uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-black font-mono text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function ProxyEfficiencySummary({ rows }) {
  const totalRuns = rows.reduce((s, r) => s + r.total, 0);
  const totalSuccess = rows.reduce((s, r) => s + r.success, 0);
  const totalFailure = rows.reduce((s, r) => s + r.failure, 0);
  const attempted = totalSuccess + totalFailure;
  const overallRate = attempted > 0 ? (totalSuccess / attempted) * 100 : 0;
  const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);
  const cps = totalSuccess > 0 ? totalCost / totalSuccess : null;

  // Weighted mean latency
  const totalLatencyWeighted = rows.reduce((s, r) => s + r.avgLatencySec * r.total, 0);
  const avgLatency = totalRuns > 0 ? totalLatencyWeighted / totalRuns : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card icon={Target}    label="Total Runs"       value={totalRuns.toLocaleString()} sub={`${totalSuccess} ✓ · ${totalFailure} ✗`} color="cyan" />
      <Card icon={TrendingUp} label="Overall Success" value={`${overallRate.toFixed(1)}%`} sub={`across ${rows.length} provider${rows.length !== 1 ? 's' : ''}`} color="emerald" />
      <Card icon={Clock}     label="Avg Latency"      value={formatLatency(avgLatency)} sub="mean session duration" color="yellow" />
      <Card icon={DollarSign} label="Cost / Success"  value={formatCostPerSuccess(cps)} sub={`$${totalCost.toFixed(2)} total`} color="pink" />
    </div>
  );
}