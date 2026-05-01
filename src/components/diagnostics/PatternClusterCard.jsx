import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Lock, KeyRound, AlertTriangle, Shield, Gauge, Clock,
  Zap, WifiOff, ServerCrash, HelpCircle, ChevronDown, ChevronUp, Wrench, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { suggestRemediation } from '@/lib/diagnostics/remediations';

const ICONS = {
  ShieldAlert, Lock, KeyRound, AlertTriangle, Shield, Gauge, Clock,
  Zap, WifiOff, ServerCrash, HelpCircle,
};

const tints = {
  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-300', iconBg: 'bg-amber-500/10' },
  red:   { border: 'border-red-500/30',   bg: 'bg-red-500/5',   text: 'text-red-300',   iconBg: 'bg-red-500/10' },
  gray:  { border: 'border-gray-700',     bg: 'bg-gray-800/40', text: 'text-gray-300',  iconBg: 'bg-gray-800' },
};

const SWAP_ICON = { proxy: Shield, credential: KeyRound, config: Wrench, manual: HelpCircle };

/**
 * One pattern = one card. Shows count, suggested remediation, the swap CTA,
 * and an expandable list of sample failed records.
 */
export default function PatternClusterCard({ cluster, ctx, onSmartRetry }) {
  const [open, setOpen] = useState(false);
  const t = tints[cluster.color] || tints.gray;
  const Icon = ICONS[cluster.icon] || HelpCircle;
  const remedy = suggestRemediation(cluster.kind, ctx);
  const SwapIcon = SWAP_ICON[remedy.swap] || HelpCircle;

  const sample = cluster.items.slice(0, open ? 50 : 5);

  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} overflow-hidden`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`w-10 h-10 rounded-lg ${t.iconBg} ${t.border} border flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${t.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-bold ${t.text}`}>{cluster.label}</h3>
            <Badge className="bg-gray-800 text-gray-200 border-gray-700">{cluster.items.length} failure{cluster.items.length === 1 ? '' : 's'}</Badge>
          </div>
          <div className="mt-2 text-sm text-gray-200 font-medium flex items-center gap-1.5">
            <SwapIcon className="w-3.5 h-3.5 text-gray-400" /> {remedy.action}
          </div>
          <p className="text-xs text-gray-500 mt-1">{remedy.why}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Link to={remedy.ctaTo}>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold gap-1.5 h-8">
                <SwapIcon className="w-3.5 h-3.5" /> {remedy.ctaLabel}
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {open ? 'Hide samples' : `Show samples (${Math.min(cluster.items.length, 50)})`}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800 bg-gray-950/40 max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-950/90 text-gray-500">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">When</th>
                <th className="px-3 py-1.5 font-medium">Source</th>
                <th className="px-3 py-1.5 font-medium">Target</th>
                <th className="px-3 py-1.5 font-medium">Message</th>
                <th className="px-3 py-1.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((rec) => (
                <tr key={rec.id} className="border-t border-gray-800/60">
                  <td className="px-3 py-1.5 font-mono text-gray-500 whitespace-nowrap">
                    {rec.when ? format(new Date(rec.when), 'MM-dd HH:mm') : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-400">{rec.source}</td>
                  <td className="px-3 py-1.5 text-gray-300 truncate max-w-[180px]" title={rec.target}>{rec.target}</td>
                  <td className="px-3 py-1.5 text-gray-500 truncate max-w-[320px]" title={rec.message}>{rec.message}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => onSmartRetry?.(rec, remedy)}
                      className="h-6 px-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 gap-1">
                      <RefreshCw className="w-3 h-3" /> Retry
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cluster.items.length > sample.length && (
            <div className="text-center text-xs text-gray-600 py-2">
              Showing {sample.length} of {cluster.items.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}