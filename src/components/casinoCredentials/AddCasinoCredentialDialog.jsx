import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOE_FORTUNE, IGNITION } from '@/lib/auCasino';
import { Loader2, Plus } from 'lucide-react';

/** Compact dialog to add a single credential manually. */
export default function AddCasinoCredentialDialog({ open, onOpenChange, onAdd }) {
  const [site, setSite] = useState(JOE_FORTUNE.key);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setSite(JOE_FORTUNE.key); setEmail(''); setPassword(''); };

  const handleSave = async () => {
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    try {
      await onAdd({ site, email: email.trim(), password: password.trim(), source: 'manual' });
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-4 h-4 text-emerald-400" /> Add credential
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Site</Label>
            <Select value={site} onValueChange={setSite}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value={JOE_FORTUNE.key} className="text-gray-200">{JOE_FORTUNE.label}</SelectItem>
                <SelectItem value={IGNITION.key} className="text-gray-200">{IGNITION.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-gray-800 border-gray-700 text-gray-200 h-9" />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
              className="bg-gray-800 border-gray-700 text-gray-200 h-9 font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!email.trim() || !password.trim() || saving}
            className="bg-emerald-500 hover:bg-emerald-400 text-black gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}