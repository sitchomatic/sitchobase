/**
 * /help/runbook — in-app runbook (#50).
 * Operator-facing guide for common issues, with one-click diagnostic links.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, AlertCircle, CheckCircle, Activity, Wrench } from 'lucide-react';

const ITEMS = [
  {
    title: 'BB returning 401 Unauthorized',
    causes: [
      'API key was revoked or rotated',
      'Wrong project ID for this API key',
      'Stripped characters during copy/paste (Settings warns about this)',
    ],
    steps: [
      'Open Settings and re-paste your API key and Project ID.',
      'Click Test Connection — it shows which side failed.',
      'If it still fails, check /status for the last request ID and correlate with bbProxy logs.',
    ],
    action: { label: 'Open Settings', to: '/settings' },
  },
  {
    title: 'Serverless batch stuck',
    causes: [
      'Backend wall-clock budget (25s) exceeded — batch returns partial results.',
      'Polling tab was closed (backend keeps running, UI loses updates).',
    ],
    steps: [
      'Open Authorized Bulk QA — look for incomplete=true in the latest run.',
      'Rerun just the missing rows. Idempotency keys prevent duplicate sessions.',
      'For long batches, prefer browser mode or split into smaller batches.',
    ],
    action: { label: 'Go to Authorized Bulk QA', to: '/bulk' },
  },
  {
    title: 'Proxy pool exhausted / burning too fast',
    causes: [
      'All enabled proxies have high failure rates',
      'A single provider is under-provisioned',
    ],
    steps: [
      'Open /proxies/efficiency to see per-provider success/latency/cost.',
      'Disable proxies with <50% success until their provider recovers.',
      'Import a fresh pool or switch proxy source to bb-au.',
    ],
    action: { label: 'Proxy Efficiency', to: '/proxies/efficiency' },
  },
  {
    title: 'Blank screen / app won\'t load',
    causes: [
      'Unhandled render error (the ErrorBoundary should catch most)',
      'Stale credentials (auth required)',
    ],
    steps: [
      'Check /status for API health and circuit breaker state.',
      'Open DevTools Console — recent errors are also written to FrontendError (admin-only).',
      'Try hard reload (⌘⇧R / Ctrl+Shift+R).',
    ],
    action: { label: 'Check Status', to: '/status' },
  },
  {
    title: 'Rate-limited (429) from bbProxy',
    causes: [
      'Too many reads (>60/min), writes (>10/min), or batches (>3/min) per user',
    ],
    steps: [
      'Wait 60s — buckets are rolling windows.',
      'If persistent, a background poll is misbehaving — check Dashboard and close extra tabs.',
    ],
    action: { label: 'Check Dashboard', to: '/' },
  },
];

export default function Runbook() {
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Runbook</h1>
              <p className="text-xs text-gray-500">Common issues and one-click diagnostics</p>
            </div>
          </div>
          <Link to="/status">
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-2">
              <Activity className="w-3.5 h-3.5" /> Status
            </Button>
          </Link>
        </div>

        {ITEMS.map((item) => (
          <div key={item.title} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white">{item.title}</span>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">Likely causes</div>
                <ul className="list-disc list-inside text-gray-300 text-xs space-y-0.5">
                  {item.causes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">Steps</div>
                <ol className="list-decimal list-inside text-gray-300 text-xs space-y-0.5">
                  {item.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
              {item.action && (
                <Link to={item.action.to}>
                  <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-2 mt-2">
                    <Wrench className="w-3.5 h-3.5" /> {item.action.label}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}

        <div className="text-center text-[11px] text-gray-600 pt-3">
          <CheckCircle className="w-3 h-3 inline mr-1" />
          Keep this page bookmarked. New items will be added as incidents happen.
        </div>
      </div>
    </div>
  );
}