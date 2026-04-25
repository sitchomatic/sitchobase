/**
 * One-click import of the bundled AU HTTPS proxy fleet defined in
 * `lib/auMobilePreset.js`. Only renders if the fleet is configured.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { parseProxyList } from '@/lib/proxyPool';
import { buildAuHttpsFleetText, AU_HTTPS_FLEET } from '@/lib/auMobilePreset';
import { Button } from '@/components/ui/button';
import { Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProxyAuFleetImport({ onImported }) {
  const [importing, setImporting] = useState(false);

  if (!AU_HTTPS_FLEET?.ports?.length) return null;

  const importFleet = async () => {
    if (!window.confirm(`Import ${AU_HTTPS_FLEET.ports.length} AU HTTPS proxies into the pool?`)) return;
    setImporting(true);
    const records = parseProxyList(buildAuHttpsFleetText());
    const tagged = records.map((r) => ({
      ...r,
      label: `AU-HTTPS ${r.server}`,
      provider: 'au-https-fleet',
      country: 'AU',
    }));
    let created = 0;
    let failed = 0;
    for (const rec of tagged) {
      try {
        await base44.entities.ProxyPool.create(rec);
        created++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    if (created > 0) toast.success(`Imported ${created} AU proxies${failed ? ` (${failed} failed)` : ''}`);
    else toast.error('No proxies imported');
    onImported?.();
  };

  return (
    <Button
      onClick={importFleet}
      disabled={importing}
      variant="outline"
      className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 gap-2"
      title={`Bulk import the ${AU_HTTPS_FLEET.ports.length}-proxy AU HTTPS fleet`}
    >
      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
      Import AU Fleet ({AU_HTTPS_FLEET.ports.length})
    </Button>
  );
}