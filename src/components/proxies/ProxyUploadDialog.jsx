import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { parseProxyList } from '@/lib/proxyPool';
import { toast } from 'sonner';

export default function ProxyUploadDialog({ open, onOpenChange, onImport }) {
  const [text, setText] = useState('');
  const [provider, setProvider] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);

  const handleImport = async () => {
    const parsed = parseProxyList(text);
    if (parsed.length === 0) {
      toast.error('No valid proxies found. Use host:port:user:pass per line.');
      return;
    }
    setBusy(true);
    const enriched = parsed.map((p) => ({
      ...p,
      provider: provider || undefined,
      country: country || undefined,
      label: p.label || `${provider || 'Proxy'} ${p.server}`,
    }));
    await onImport(enriched);
    setBusy(false);
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Proxies</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-400">Provider (optional)</Label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)}
                placeholder="oxylabs" className="bg-gray-950 border-gray-800" />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Country (optional)</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="AU" maxLength={2} className="bg-gray-950 border-gray-800" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400">
              Paste proxies (one per line — <span className="font-mono text-emerald-400">host:port:user:pass</span>)
            </Label>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={`pr.oxylabs.io:7777:user1:pass1\npr.oxylabs.io:7777:user2:pass2\nuser:pass@gate.smartproxy.com:10000`}
              className="bg-gray-950 border-gray-800 font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-gray-700">Cancel</Button>
          <Button onClick={handleImport} disabled={busy || !text.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}