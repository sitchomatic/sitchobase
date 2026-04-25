/**
 * /admin/operations — manual triggers + last-result view for the two
 * scheduled-only backend functions: sendOpsSummary (daily ops alert)
 * and cleanupOldJoeIgniteRuns (90-day record purge).
 *
 * Admin-only.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Activity, Trash2, PlayCircle, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

function ResultBlock({ result }) {
  if (!result) return null;
  if (result.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs">
        <div className="flex items-center gap-1.5 text-red-300 font-semibold mb-1">
          <AlertCircle className="w-3.5 h-3.5" /> Failed
        </div>
        <div className="text-red-200 break-words">{result.error}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
      <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
        <CheckCircle className="w-3.5 h-3.5" /> Success
      </div>
      <pre className="text-[11px] text-gray-300 whitespace-pre-wrap overflow-x-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

function OpCard({ icon: Icon, title, description, scheduleNote, runFn, color = 'emerald' }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [ranAt, setRanAt] = useState(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runFn();
      setResult(res?.data || res);
      setRanAt(new Date());
      toast.success(`${title} complete`);
    } catch (e) {
      setResult({ error: e?.message || 'Unknown error' });
      toast.error(`${title} failed`);
    }
    setRunning(false);
  };

  const colorCls = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  }[color];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorCls}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
          {scheduleNote && (
            <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {scheduleNote}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={run} disabled={running} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black gap-2">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
          {running ? 'Running…' : 'Run now'}
        </Button>
        {ranAt && <span className="text-[11px] text-gray-500">last manual run · {ranAt.toLocaleTimeString()}</span>}
      </div>

      <ResultBlock result={result} />
    </div>
  );
}

export default function AdminOperations() {
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Operations</h1>
              <p className="text-xs text-gray-500">Manually trigger scheduled backend tasks and view their results.</p>
            </div>
          </div>
          <Link to="/"><Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Dashboard</Button></Link>
        </div>

        <OpCard
          icon={Activity}
          title="Daily Ops Summary"
          description="Computes today's bbProxy error rate and slow-call count. Returns alerts when thresholds are exceeded."
          scheduleNote="Auto-runs daily at 22:00 (Sydney)"
          color="emerald"
          runFn={() => base44.functions.invoke('sendOpsSummary', {})}
        />

        <OpCard
          icon={Trash2}
          title="Cleanup Old Records"
          description="Deletes JoeIgniteRun, SlowCall, and FrontendError records older than 90 days, plus expired IdempotencyKey records. Up to 500 per entity per run."
          scheduleNote="Auto-runs daily at 17:00 (Sydney)"
          color="red"
          runFn={() => base44.functions.invoke('cleanupOldJoeIgniteRuns', {})}
        />

        <div className="text-[11px] text-gray-600 text-center pt-3">
          Both tasks are also wired to scheduled automations and run automatically.
        </div>
      </div>
    </div>
  );
}