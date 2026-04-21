import { useRef } from 'react';
import { parseCSV } from '@/lib/csvParser';
import { Button } from '@/components/ui/button';
import { FileUp, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';

export default function JoeIgniteCsvPicker({ loaded, onLoaded, onClear }) {
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    const hasEmail = headers.includes('email');
    const hasPassword = headers.includes('password');
    if (!hasEmail || !hasPassword) {
      toast.error('CSV must have "email" and "password" columns');
      return;
    }
    const creds = rows
      .map((r) => ({ email: (r.email || '').trim(), password: (r.password || '').trim() }))
      .filter((c) => c.email && c.password);
    if (creds.length === 0) {
      toast.error('No valid credential rows found');
      return;
    }
    onLoaded({ fileName: file.name, credentials: creds });
    toast.success(`${creds.length} credentials loaded`);
  };

  if (!loaded) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-900/50 p-8">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Upload credentials CSV</div>
            <div className="text-xs text-gray-500 mt-1">Required columns: <code className="text-emerald-400">email</code>, <code className="text-emerald-400">password</code></div>
          </div>
          <Button onClick={() => inputRef.current?.click()} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2">
            <FileUp className="w-4 h-4" /> Choose CSV
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{loaded.fileName}</div>
        <div className="text-xs text-gray-400">{loaded.credentials.length} credentials ready</div>
      </div>
      <Button size="icon" variant="ghost" onClick={onClear} className="text-gray-500 hover:text-red-400">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}