import { useRef } from 'react';
import { Upload, FileText, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CsvUploader({ headers, rows, requiredColumns, onLoad, onClear }) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onLoad(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const missingCols = requiredColumns.filter(c => !headers.includes(c));

  if (rows.length === 0) {
    return (
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-8 text-center cursor-pointer transition-colors group"
      >
        <Upload className="w-8 h-8 text-gray-600 group-hover:text-gray-400 mx-auto mb-3 transition-colors" />
        <div className="text-sm text-gray-400 font-medium mb-1">Upload CSV file</div>
        <div className="text-xs text-gray-600">First row must be headers matching script placeholders</div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-white font-medium">{rows.length} rows loaded</span>
          <div className="flex flex-wrap gap-1">
            {headers.map(h => (
              <Badge key={h}
                className={`text-xs font-mono ${missingCols.includes(h) ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                {h}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClear} className="w-7 h-7 text-gray-500 hover:text-red-400">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {missingCols.length > 0 && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">
            CSV is missing columns required by the script: <strong>{missingCols.map(c => `{{${c}}}`).join(', ')}</strong>
          </p>
        </div>
      )}

      {/* Preview table */}
      <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800">
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-8">#</th>
                {headers.map(h => (
                  <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-3 py-1.5 text-gray-600">{i + 1}</td>
                  {headers.map(h => (
                    <td key={h} className="px-3 py-1.5 text-gray-300 max-w-[160px] truncate">{row[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 20 && (
          <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-700">
            + {rows.length - 20} more rows not shown
          </div>
        )}
      </div>
    </div>
  );
}