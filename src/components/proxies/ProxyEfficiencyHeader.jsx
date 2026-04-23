import { Button } from '@/components/ui/button';
import { BarChart3, RotateCw } from 'lucide-react';

export default function ProxyEfficiencyHeader({ windowDays, runCount, onRefresh, loading }) {
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-transparent px-5 py-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
      </div>
      <div className="flex-1">
        <h1 className="text-lg font-bold text-white">Proxy Efficiency</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Last {windowDays} days · {runCount.toLocaleString()} Joe Ignite runs · grouped by provider
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}
        className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
        <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </Button>
    </div>
  );
}