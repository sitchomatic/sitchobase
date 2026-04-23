import { useState } from 'react';
import { bbClient, getCircuitState, getLastRequestId } from '@/lib/bbClient';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, PlayCircle } from 'lucide-react';

export default function AdminSelfTest() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);

  const runChecks = async () => {
    setRunning(true);
    const next = [];

    try {
      const sessions = await bbClient.listSessions();
      next.push({ label: 'Browserbase listSessions', ok: true, detail: `${Array.isArray(sessions) ? sessions.length : 0} sessions` });
    } catch (error) {
      next.push({ label: 'Browserbase listSessions', ok: false, detail: error.message, requestId: error.requestId || getLastRequestId() });
    }

    try {
      const usage = await bbClient.getProjectUsage();
      next.push({ label: 'Project usage', ok: true, detail: `${usage?.browserMinutes ?? '—'} browser minutes` });
    } catch (error) {
      next.push({ label: 'Project usage', ok: false, detail: error.message, requestId: error.requestId || getLastRequestId() });
    }

    const circuit = getCircuitState();
    next.push({ label: 'Circuit breaker', ok: circuit.state === 'closed', detail: `State: ${circuit.state} · failures: ${circuit.failures}` });

    setResults(next);
    setRunning(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Admin Self-Test</h1>
        <p className="text-sm text-gray-500 mt-1">Run a quick health sweep across the key runtime paths.</p>
      </div>

      <Button onClick={runChecks} disabled={running} className="bg-emerald-500 hover:bg-emerald-600 text-black gap-2">
        <PlayCircle className="w-4 h-4" /> {running ? 'Running…' : 'Run checks'}
      </Button>

      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.label} className={`rounded-xl border p-4 ${result.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex items-start gap-3">
              {result.ok ? <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{result.label}</div>
                <div className="text-xs text-gray-400 mt-1 break-words">{result.detail}</div>
                {result.requestId && <div className="text-[11px] text-gray-500 font-mono mt-2">Request ID: {result.requestId}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}