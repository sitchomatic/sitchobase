/**
 * CasinoCredentials — dedicated rotation manager for Joe Fortune & Ignition
 * accounts. Source of truth is the CasinoCredential entity. Each credential
 * row supports:
 *   • inline password rotation (saves new password, retains previous, stamps
 *     lastRotatedAt)
 *   • real headless login validation via the AU mobile preset (records
 *     lastValidationStatus / lastValidatedAt / Browserbase session ID for
 *     replay)
 *   • burn flag + delete
 *
 * Imports consolidate the three sources discussed earlier:
 *   1. Manual single-credential add (AddCasinoCredentialDialog)
 *   2. CSV upload matching the AuthorizedBulkQA shape
 *   3. JoeIgniteRun history (unique emails from past batch runs)
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCredentials } from '@/lib/useCredentials';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOE_FORTUNE, IGNITION } from '@/lib/auCasino';
import { validateCasinoCredential } from '@/lib/casinoCredentialValidator';
import { auditLog } from '@/lib/auditLog';
import CasinoCredentialRow from '@/components/casinoCredentials/CasinoCredentialRow';
import AddCasinoCredentialDialog from '@/components/casinoCredentials/AddCasinoCredentialDialog';
import ImportCredentialsPanel from '@/components/casinoCredentials/ImportCredentialsPanel';
import { KeyRound, Plus, RefreshCw, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SITE_FILTERS = [
  { value: 'ALL', label: 'All sites' },
  { value: JOE_FORTUNE.key, label: JOE_FORTUNE.label },
  { value: IGNITION.key, label: IGNITION.label },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Any status' },
  { value: 'unknown', label: 'Untested' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'locked', label: 'Locked / review' },
  { value: 'error', label: 'Error' },
];

export default function CasinoCredentials() {
  const { isConfigured } = useCredentials();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [validatingIds, setValidatingIds] = useState(new Set());
  const [bulkValidating, setBulkValidating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.CasinoCredential.list('-updated_date', 200);
      setCredentials(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => credentials.filter((c) => {
    if (siteFilter !== 'ALL' && c.site !== siteFilter) return false;
    if (statusFilter !== 'ALL' && (c.lastValidationStatus || 'unknown') !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.email || '').toLowerCase().includes(q) || (c.label || '').toLowerCase().includes(q);
    }
    return true;
  }), [credentials, siteFilter, statusFilter, search]);

  const counts = useMemo(() => ({
    total: credentials.length,
    valid: credentials.filter((c) => c.lastValidationStatus === 'valid').length,
    invalid: credentials.filter((c) => c.lastValidationStatus === 'invalid').length,
    untested: credentials.filter((c) => !c.lastValidationStatus || c.lastValidationStatus === 'unknown').length,
    burned: credentials.filter((c) => c.isBurned).length,
  }), [credentials]);

  const handleAdd = async (payload) => {
    const created = await base44.entities.CasinoCredential.create({
      ...payload,
      lastValidationStatus: 'unknown',
    });
    setCredentials((prev) => [created, ...prev]);
    auditLog({ action: 'CASINO_CREDENTIAL_ADDED', category: 'settings', targetId: created.id, details: { site: payload.site, source: payload.source } });
    toast.success('Credential added');
  };

  const handleRotate = async (cred, newPassword) => {
    const updated = await base44.entities.CasinoCredential.update(cred.id, {
      password: newPassword,
      previousPassword: cred.password,
      lastRotatedAt: new Date().toISOString(),
      // Force re-validation after a rotation — old status no longer applies.
      lastValidationStatus: 'unknown',
      lastValidationDetails: 'Rotated — pending re-validation',
    });
    setCredentials((prev) => prev.map((c) => (c.id === cred.id ? { ...c, ...updated } : c)));
    auditLog({ action: 'CASINO_CREDENTIAL_ROTATED', category: 'settings', targetId: cred.id, details: { site: cred.site, email: cred.email } });
    toast.success(`Password rotated for ${cred.email}`);
  };

  const runValidation = useCallback(async (cred) => {
    setValidatingIds((prev) => new Set(prev).add(cred.id));
    try {
      const result = await validateCasinoCredential({
        site: cred.site, email: cred.email, password: cred.password,
      });
      const updated = await base44.entities.CasinoCredential.update(cred.id, {
        lastValidationStatus: result.status,
        lastValidationDetails: result.details,
        lastValidatedAt: new Date().toISOString(),
        lastValidationSessionId: result.sessionId || null,
      });
      setCredentials((prev) => prev.map((c) => (c.id === cred.id ? { ...c, ...updated } : c)));
      auditLog({
        action: 'CASINO_CREDENTIAL_VALIDATED',
        category: 'settings',
        targetId: cred.id,
        status: result.status === 'valid' ? 'success' : 'failure',
        details: { site: cred.site, email: cred.email, outcome: result.status, sessionId: result.sessionId },
      });
      const tone = result.status === 'valid' ? toast.success : result.status === 'invalid' ? toast.error : toast.warning;
      tone(`${cred.email}: ${result.status}`);
      return result;
    } catch (err) {
      toast.error(`Validation failed: ${err.message}`);
    } finally {
      setValidatingIds((prev) => { const next = new Set(prev); next.delete(cred.id); return next; });
    }
  }, []);

  const handleValidateAllVisible = async () => {
    if (bulkValidating) return;
    setBulkValidating(true);
    try {
      // Sequential to keep Browserbase concurrency low and avoid tripping
      // anti-bot heuristics with parallel logins from the same proxy fleet.
      for (const cred of filtered) {
        if (cred.isBurned || !cred.password) continue;
        await runValidation(cred);
      }
      toast.success('Bulk validation complete');
    } finally {
      setBulkValidating(false);
    }
  };

  const handleDelete = async (cred) => {
    if (!confirm(`Delete credential ${cred.email}? This cannot be undone.`)) return;
    await base44.entities.CasinoCredential.delete(cred.id);
    setCredentials((prev) => prev.filter((c) => c.id !== cred.id));
    auditLog({ action: 'CASINO_CREDENTIAL_DELETED', category: 'settings', targetId: cred.id, details: { site: cred.site, email: cred.email } });
    toast.success('Credential deleted');
  };

  const handleToggleBurn = async (cred) => {
    const updated = await base44.entities.CasinoCredential.update(cred.id, { isBurned: !cred.isBurned });
    setCredentials((prev) => prev.map((c) => (c.id === cred.id ? { ...c, ...updated } : c)));
    auditLog({ action: 'CASINO_CREDENTIAL_BURN_TOGGLED', category: 'settings', targetId: cred.id, details: { site: cred.site, isBurned: !cred.isBurned } });
  };

  if (!isConfigured) return <CredentialsGuard />;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Casino Credential Rotation</h1>
            <p className="text-xs text-gray-500">Manage Joe Fortune & Ignition logins · validate via real headless login</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add credential
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: counts.total, color: 'text-white' },
          { label: 'Valid', value: counts.valid, color: 'text-emerald-400' },
          { label: 'Invalid', value: counts.invalid, color: 'text-red-400' },
          { label: 'Untested', value: counts.untested, color: 'text-gray-300' },
          { label: 'Burned', value: counts.burned, color: 'text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <ImportCredentialsPanel existing={credentials} onImported={load} />

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
          <Input placeholder="Search email or label…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8" />
        </div>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {SITE_FILTERS.map((o) => <SelectItem key={o.value} value={o.value} className="text-gray-200">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-gray-200 text-sm h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {STATUS_FILTERS.map((o) => <SelectItem key={o.value} value={o.value} className="text-gray-200">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkValidating || filtered.length === 0}
          onClick={handleValidateAllVisible}
          className="h-8 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 gap-1.5 text-xs"
        >
          {bulkValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Test all visible ({filtered.length})
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && credentials.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">Loading credentials…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <KeyRound className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <div className="text-sm text-gray-400 mb-1">No credentials yet</div>
            <div className="text-xs text-gray-600">
              Add one manually, import a CSV, or pull historic emails from JoeIgniteRun above.
            </div>
          </div>
        )}
        {filtered.map((c) => (
          <CasinoCredentialRow
            key={c.id}
            credential={c}
            isValidating={validatingIds.has(c.id)}
            onRotate={handleRotate}
            onValidate={runValidation}
            onDelete={handleDelete}
            onToggleBurn={handleToggleBurn}
          />
        ))}
      </div>

      <AddCasinoCredentialDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAdd} />
    </div>
  );
}