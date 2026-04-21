import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TestReports() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TestRun.list('-created_date', 50);
    setRuns(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" /> Test Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Aggregated pass/fail reporting for batch test runs</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500">Total Runs</div>
          <div className="text-2xl font-bold text-white mt-1">{runs.length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500">Avg Success Rate</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {runs.length ? Math.round(runs.reduce((sum, run) => sum + (run.successRate || 0), 0) / runs.length) : 0}%
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500">Completed Runs</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{runs.filter(run => run.status === 'completed').length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {runs.map((run) => (
          <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{run.suiteName}</div>
                <div className="text-xs text-gray-500">{run.totalSessions} sessions · {run.successRate || 0}% success</div>
              </div>
              <Badge className={run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}>
                {run.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-gray-500">Passed</div>
                <div className="text-emerald-400 font-semibold mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {run.passedSessions || 0}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-gray-500">Failed</div>
                <div className="text-red-400 font-semibold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {run.failedSessions || 0}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-gray-500">Suite</div>
                <div className="text-white font-semibold mt-1 truncate">{run.suiteName}</div>
              </div>
              <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-gray-500">Status</div>
                <div className="text-white font-semibold mt-1 capitalize">{run.status}</div>
              </div>
            </div>
          </div>
        ))}

        {!loading && runs.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-sm text-gray-500">
            No test reports yet.
          </div>
        )}
      </div>
    </div>
  );
}