import { useState } from 'react';
import { Network, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NordLynxResult from '@/components/nordlynx/NordLynxResult';
import { toast } from 'sonner';

export default function NordLynxProxy() {
  const [accessToken, setAccessToken] = useState('');
  const [country, setCountry] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!accessToken.trim()) {
      toast.error('Nord access token is required');
      return;
    }
    setLoading(true);
    setResult(null);
    const response = await base44.functions.invoke('nordLynxConfig', { accessToken: accessToken.trim(), country: country.trim() || 'US' });
    if (response.data?.error) {
      toast.error(response.data.error);
    } else {
      setResult(response.data);
      toast.success('NordLynx cloud proxy bundle generated');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full bg-gray-950 p-6 max-w-6xl mx-auto space-y-5">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Network className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">NordLynx Cloud Proxy Engine</h1>
            <p className="text-sm text-gray-500">Headless-ready NordLynx IP management via a WireGuard-backed SOCKS5 browser bridge.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label className="text-xs text-gray-400 mb-1.5 block">NordVPN Access Token</Label>
            <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Paste token…" className="bg-gray-950 border-gray-800 text-gray-100 font-mono" />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1.5 block">Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US, Germany, Australia…" className="bg-gray-950 border-gray-800 text-gray-100" />
          </div>
        </div>
        <Button onClick={generate} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate Cloud Proxy Bundle'}
        </Button>
      </div>

      <NordLynxResult result={result} />

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
        <div className="font-bold text-white mb-2">Runtime boundary</div>
        Base44 can generate and validate the NordLynx configuration, but persistent WireGuard and SOCKS5 daemons must run in your Docker/cloud browser worker where network interfaces are available.
      </div>
    </div>
  );
}