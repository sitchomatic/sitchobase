import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { parseCSV } from '@/lib/csvParser';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { JOE_FORTUNE, IGNITION } from '@/lib/auCasino';
import { Upload, Database, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Import credentials from two existing sources:
 *  1. JoeIgniteRun history — pulls unique emails from prior batch runs.
 *  2. CSV upload — same shape Authorized Bulk QA already supports
 *     (columns: email or username, password). The user's current site
 *     selection determines which casino the imported rows belong to.
 *
 * Each row is upserted (by site+email) so re-imports refresh the password
 * but preserve rotation history.
 */
export default function ImportCredentialsPanel({ existing, onImported }) {
  const [importSite, setImportSite] = useState(JOE_FORTUNE.key);
  const [importing, setImporting] = useState(false);
  const [importingFromRuns, setImportingFromRuns] = useState(false);

  const upsertRow = async ({ site, email, password, source }) => {
    const match = existing.find((c) => c.site === site && c.email.toLowerCase() === email.toLowerCase());
    if (match) {
      if (password && password !== match.password) {
        return base44.entities.CasinoCredential.update(match.id, {
          password,
          previousPassword: match.password,
          lastRotatedAt: new Date().toISOString(),
          source,
        });
      }
      return null; // no change
    }
    return base44.entities.CasinoCredential.create({
      site, email, password: password || '', source,
      lastValidationStatus: 'unknown',
    });
  };

  const importFromCsv = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      const emailKey = headers.find((h) => /^(email|username)$/i.test(h));
      const passKey = headers.find((h) => /^password$/i.test(h));
      if (!emailKey || !passKey) {
        toast.error('CSV must have "email" (or "username") and "password" columns');
        return;
      }
      let added = 0; let updated = 0;
      for (const row of rows) {
        const email = String(row[emailKey] || '').trim();
        const password = String(row[passKey] || '').trim();
        if (!email || !password) continue;
        const result = await upsertRow({ site: importSite, email, password, source: 'bulkCsv' });
        if (!result) continue;
        if (result.lastRotatedAt) updated++;
        else added++;
      }
      toast.success(`Imported ${added} new, rotated ${updated} existing`);
      onImported();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const importFromJoeIgniteRuns = async () => {
    setImportingFromRuns(true);
    try {
      const runs = await base44.entities.JoeIgniteRun.list('-startedAt', 500);
      const seen = new Set();
      const unique = [];
      for (const r of runs || []) {
        if (!r.email) continue;
        const key = r.email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
      }
      let added = 0;
      for (const r of unique) {
        const result = await upsertRow({
          site: importSite,
          email: r.email,
          password: '', // JoeIgniteRun doesn't store passwords
          source: 'joeIgniteRun',
        });
        if (result && !result.lastRotatedAt) added++;
      }
      toast.success(`Imported ${added} unique emails from JoeIgniteRun history`);
      onImported();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImportingFromRuns(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Database className="w-4 h-4 text-cyan-400" /> Import credentials
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-1 block">Import as site</Label>
        <Select value={importSite} onValueChange={setImportSite}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value={JOE_FORTUNE.key} className="text-gray-200">{JOE_FORTUNE.label}</SelectItem>
            <SelectItem value={IGNITION.key} className="text-gray-200">{IGNITION.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; importFromCsv(f); }}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-2 h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 text-xs font-medium hover:bg-emerald-500/10 transition-colors">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            CSV (email,password)
          </div>
        </label>

        <Button
          variant="outline"
          disabled={importingFromRuns}
          onClick={importFromJoeIgniteRuns}
          className="h-9 border-purple-500/30 bg-purple-500/5 text-purple-300 hover:bg-purple-500/10 gap-2 text-xs"
        >
          {importingFromRuns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          From JoeIgniteRun history
        </Button>
      </div>

      <p className="text-xs text-gray-600">
        Existing credentials are matched by site + email. Re-imports with a different password create a rotation entry.
      </p>
    </div>
  );
}