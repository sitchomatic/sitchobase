import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, Download, Trash2, FileJson, FileSpreadsheet, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getLogs, clearLogs, subscribe, toCSV } from '@/lib/monitoringLog';
import { toast } from 'sonner';

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const PROVIDERS = ['ALL', 'browserbase', 'browserless', 'scrapingbee'];
const LEVELS = ['ALL', 'info', 'error'];

/**
 * Centralised log viewer + export for the Browser Monitoring page.
 * Subscribes to the in-memory buffer in lib/monitoringLog.js.
 */
export default function LogExportPanel() {
  const [logs, setLogs] = useState(getLogs());
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');

  useEffect(() => subscribe((next) => setLogs(next.slice())), []);

  const filtered = useMemo(() => logs.filter((l) =>
    (providerFilter === 'ALL' || l.provider === providerFilter) &&
    (levelFilter === 'ALL' || l.level === levelFilter)
  ), [logs, providerFilter, levelFilter]);

  const stamp = format(new Date(), 'yyyyMMdd-HHmmss');

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/80 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-800 bg-gray-950/40">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-gray-400" />
          <div>
            <div className="text-sm font-bold text-white">Monitoring Log</div>
            <div className="text-xs text-gray-500">{filtered.length} of {logs.length} entries · in-memory ring buffer (max 500)</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-xs h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {PROVIDERS.map((p) => <SelectItem key={p} value={p} className="text-gray-200 capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 text-xs h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {LEVELS.map((l) => <SelectItem key={l} value={l} className="text-gray-200 capitalize">{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setLogs(getLogs())}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            downloadBlob(JSON.stringify(filtered, null, 2), `browser-monitoring-${stamp}.json`, 'application/json');
            toast.success(`Exported ${filtered.length} entries as JSON`);
          }}
            disabled={filtered.length === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
            <FileJson className="w-3.5 h-3.5" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            downloadBlob(toCSV(filtered), `browser-monitoring-${stamp}.csv`, 'text/csv');
            toast.success(`Exported ${filtered.length} entries as CSV`);
          }}
            disabled={filtered.length === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            clearLogs();
            toast.success('Log buffer cleared');
          }}
            disabled={logs.length === 0}
            className="border-red-800 text-red-300 hover:bg-red-500/10 gap-1.5 h-8">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </Button>
        </div>
      </header>

      <div className="max-h-[420px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-600">
            No log entries yet — run a Connection Test or capture a screenshot to populate the buffer.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-950/60 sticky top-0">
              <tr className="text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Op</th>
                <th className="px-3 py-2 font-medium text-right">Duration</th>
                <th className="px-3 py-2 font-medium text-right">HTTP</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className={`border-t border-gray-800/60 ${l.ok ? '' : 'bg-red-500/5'}`}>
                  <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{format(new Date(l.timestamp), 'HH:mm:ss')}</td>
                  <td className="px-3 py-2 text-gray-300 capitalize">{l.provider}</td>
                  <td className="px-3 py-2 text-gray-300">{l.op}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-400">{l.duration_ms != null ? `${l.duration_ms}ms` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-400">{l.upstream_status ?? '—'}</td>
                  <td className="px-3 py-2">
                    {l.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3 h-3" /> ok</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" /> {l.error_kind || 'error'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-md truncate" title={l.error_summary || l.hint || ''}>
                    {l.error_summary || l.hint || (l.ok ? '—' : 'Failed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}