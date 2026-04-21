import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CsvUploader from '@/components/bulk/CsvUploader';
import { parseCSV } from '@/lib/csvParser';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

const REQUIRED_COLUMNS = ['name'];
const ALLOWED_REGIONS = ['us-west-2', 'us-east-1', 'eu-central-1', 'ap-southeast-1'];
const ALLOWED_DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];

function normalizeRow(row) {
  return {
    name: row.name?.trim() || '',
    userAgent: row.userAgent?.trim() || '',
    region: ALLOWED_REGIONS.includes(row.region) ? row.region : 'us-west-2',
    useProxy: String(row.useProxy).toLowerCase() === 'true',
    proxyCountry: row.proxyCountry?.trim() || '',
    deviceType: ALLOWED_DEVICE_TYPES.includes(row.deviceType) ? row.deviceType : 'desktop',
    notes: row.notes?.trim() || '',
  };
}

export default function PersonaCsvImport({ onImported }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleLoad = (text) => {
    const parsed = parseCSV(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
  };

  const clear = () => {
    setHeaders([]);
    setRows([]);
  };

  const handleImport = async () => {
    const validRows = rows.map(normalizeRow).filter(row => row.name);
    if (validRows.length === 0) {
      toast.error('No valid persona rows found');
      return;
    }

    setImporting(true);
    const created = await base44.entities.Persona.bulkCreate(validRows);
    toast.success(`${validRows.length} personas imported`);
    auditLog({ action: 'PERSONAS_BULK_IMPORTED', category: 'persona', details: { count: validRows.length } });
    clear();
    onImported(created);
    setImporting(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" /> Bulk Import CSV
          </div>
          <p className="text-xs text-gray-500 mt-1">Columns: name, userAgent, region, useProxy, proxyCountry, deviceType, notes</p>
        </div>
        <Badge className="bg-gray-800 text-gray-300 border-gray-700">CSV</Badge>
      </div>

      <CsvUploader
        headers={headers}
        rows={rows}
        requiredColumns={REQUIRED_COLUMNS}
        onLoad={handleLoad}
        onClear={clear}
      />

      <Button
        onClick={handleImport}
        disabled={importing || rows.length === 0}
        className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold gap-2"
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {importing ? 'Importing…' : `Import ${rows.length} Persona${rows.length !== 1 ? 's' : ''}`}
      </Button>
    </div>
  );
}