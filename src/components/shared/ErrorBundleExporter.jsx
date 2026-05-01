/**
 * Reusable panel that builds a JSON error bundle and lets the user either
 * download it or copy it to the clipboard. The bundle is the format
 * expected by Base44 chat — paste it back here and it can be analyzed
 * and repaired automatically.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ClipboardCopy, AlertCircle, CheckCircle, Loader2, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { downloadErrorBundle, copyErrorBundle } from '@/lib/errorBundle';

export default function ErrorBundleExporter({ compact = false }) {
  const [busy, setBusy] = useState(null); // 'download' | 'copy' | null
  const [last, setLast] = useState(null);

  const onDownload = async () => {
    setBusy('download');
    try {
      const bundle = await downloadErrorBundle();
      setLast({ kind: 'download', counts: bundle.counts });
      toast.success('Error bundle downloaded');
    } catch (e) {
      toast.error(`Bundle failed: ${e.message || 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    setBusy('copy');
    try {
      const { bundle, size } = await copyErrorBundle();
      setLast({ kind: 'copy', counts: bundle.counts, size });
      toast.success('Bundle copied — paste it into Base44 chat');
    } catch (e) {
      toast.error(`Copy failed: ${e.message || 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={onCopy} disabled={!!busy} variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-1.5">
          {busy === 'copy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
          Copy bundle
        </Button>
        <Button onClick={onDownload} disabled={!!busy} variant="outline" size="sm" className="border-gray-700 text-gray-300 gap-1.5">
          {busy === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <FileJson className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Error bundle for Base44 analysis</div>
          <p className="text-xs text-gray-500 mt-0.5">
            Bundles your last 200 frontend errors, slow calls, audit failures, breadcrumbs, and runtime context into one JSON file.
            Paste it into Base44 chat so it can analyze and repair the issue.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2 text-xs text-amber-200">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          The bundle does not include passwords or API keys — only error metadata, request IDs, and your user email.
          Review before sharing if you have policies about user identifiers.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onCopy} disabled={!!busy} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold gap-2">
          {busy === 'copy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCopy className="w-4 h-4" />}
          Copy to clipboard
        </Button>
        <Button onClick={onDownload} disabled={!!busy} variant="outline" className="border-gray-700 text-gray-300 gap-2">
          {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download JSON
        </Button>
      </div>

      {last && (
        <div className="text-xs text-gray-500 flex items-center gap-2 pt-1 border-t border-gray-800">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Last bundle · frontend: {last.counts.frontendErrors} · slow: {last.counts.slowCalls} · audit failures: {last.counts.auditFailures}
          {last.size != null && <> · {Math.round(last.size / 1024)} KB</>}
        </div>
      )}
    </div>
  );
}