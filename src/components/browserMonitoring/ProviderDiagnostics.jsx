/**
 * Compact diagnostics strip rendered under each provider's section header.
 * Fed by useProviderStatus → diagnostics. Always visible once a probe has run.
 */
export default function ProviderDiagnostics({ diagnostics }) {
  if (!diagnostics) return null;
  const { clientLatencyMs, backendDurationMs, upstreamStatus, requestId, errorKind, hint } = diagnostics;
  const upstreamCls = upstreamStatus == null ? 'text-gray-500'
    : upstreamStatus < 400 ? 'text-emerald-300'
    : upstreamStatus < 500 ? 'text-amber-300'
    : 'text-red-300';
  return (
    <div className="text-[11px] font-mono flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
      <span><span className="text-gray-600">latency:</span> <span className="text-gray-300">{clientLatencyMs}ms</span></span>
      {backendDurationMs != null && (
        <span><span className="text-gray-600">backend:</span> <span className="text-gray-300">{backendDurationMs}ms</span></span>
      )}
      <span><span className="text-gray-600">upstream:</span> <span className={upstreamCls}>{upstreamStatus ?? '—'}</span></span>
      {requestId && <span><span className="text-gray-600">req:</span> <span className="text-gray-400">{requestId}</span></span>}
      {errorKind && <span className="text-red-300">{errorKind}{hint ? ` — ${hint}` : ''}</span>}
    </div>
  );
}