import { useEffect, useState } from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { compareScreenshotPixels } from '@/lib/imagePixelDiff';

export default function PixelDeviationPanel({ currentUrl, baselineUrl }) {
  const [state, setState] = useState({ loading: false, result: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    if (!currentUrl || !baselineUrl) {
      setState({ loading: false, result: null, error: '' });
      return;
    }

    setState({ loading: true, result: null, error: '' });
    compareScreenshotPixels(currentUrl, baselineUrl)
      .then((result) => !cancelled && setState({ loading: false, result, error: '' }))
      .catch((error) => !cancelled && setState({ loading: false, result: null, error: error.message || 'Pixel comparison failed' }));

    return () => {
      cancelled = true;
    };
  }, [currentUrl, baselineUrl]);

  if (!baselineUrl) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-xs text-gray-500">
        No previous successful screenshot found for this row yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-200">
          <ScanSearch className="w-3.5 h-3.5 text-cyan-300" /> Pixel deviation
        </div>
        {state.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
        {state.result && <span className="text-xs font-mono text-cyan-300">{state.result.deviationPercent}%</span>}
      </div>

      {state.error ? (
        <div className="text-xs text-yellow-400">{state.error}</div>
      ) : state.result?.diffUrl ? (
        <div className="space-y-2">
          <img src={state.result.diffUrl} alt="Pixel difference overlay" className="w-full rounded-lg border border-gray-800 bg-black" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-gray-600 mb-1">Last successful</div>
              <img src={baselineUrl} alt="Last successful screenshot" className="w-full h-20 object-cover rounded border border-gray-800" />
            </div>
            <div>
              <div className="text-[10px] text-gray-600 mb-1">Current failure</div>
              <img src={currentUrl} alt="Current failed screenshot" className="w-full h-20 object-cover rounded border border-gray-800" />
            </div>
          </div>
          <div className="text-[10px] text-gray-500">Red areas show changed pixels versus the last successful screenshot.</div>
        </div>
      ) : (
        <div className="text-xs text-gray-500">Preparing comparison…</div>
      )}
    </div>
  );
}