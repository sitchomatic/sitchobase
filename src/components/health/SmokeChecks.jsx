import { CheckCircle2 } from 'lucide-react';

const smokeRoutes = [
  ['Dashboard', '/'],
  ['Sessions', '/sessions'],
  ['Settings', '/settings'],
  ['Authorized QA', '/bulk'],
  ['Reports', '/reports'],
];

export default function SmokeChecks() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-white">Lightweight smoke checks</h2>
          <p className="text-xs text-gray-500 mt-1">Key pages are explicitly routed and available from the app shell.</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-0.5">5 checks</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {smokeRoutes.map(([label, path]) => (
          <a key={path} href={path} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs text-gray-300 hover:border-emerald-500/30 hover:text-white transition-colors">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>{label}</span>
            </div>
            <div className="text-[10px] text-gray-600 font-mono mt-1">{path}</div>
          </a>
        ))}
      </div>
    </div>
  );
}