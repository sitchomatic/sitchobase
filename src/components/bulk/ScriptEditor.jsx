import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { extractPlaceholders } from '@/lib/csvParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, X, Code2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ScriptEditor({ script, onSave, onCancel }) {
  const [name, setName] = useState(script?.name ?? '');
  const [body, setBody] = useState(script?.script ?? '');
  const [description, setDescription] = useState(script?.description ?? '');
  const [saving, setSaving] = useState(false);

  const placeholders = extractPlaceholders(body);

  const save = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), script: body.trim(), description: description.trim(), placeholders };
      let saved;
      if (script?.id) {
        saved = await base44.entities.SavedScript.update(script.id, data);
      } else {
        saved = await base44.entities.SavedScript.create(data);
      }
      toast.success('Script saved');
      onSave(saved);
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Code2 className="w-4 h-4 text-purple-400" />
          {script?.id ? 'Edit Script' : 'New Script'}
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel} className="w-7 h-7 text-gray-500 hover:text-gray-200">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Script Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Login Flow"
          className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-sm" />
      </div>

      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">
          Script Body — use <code className="text-emerald-400 bg-gray-800 px-1 rounded">{'{{column_name}}'}</code> for CSV placeholders
        </Label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={`Navigate to {{url}}\nClick the login button\nType {{username}} into the username field\nType {{password}} into the password field\nClick Submit`}
          className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs min-h-[160px] resize-y"
        />
      </div>

      {placeholders.length > 0 && (
        <div>
          <Label className="text-gray-400 text-xs mb-1.5 block">Detected Placeholders</Label>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map(p => (
              <Badge key={p} className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs">
                {`{{${p}}}`}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Your CSV must have columns matching these names exactly.</p>
        </div>
      )}

      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Description (optional)</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What does this script do?"
          className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-sm" />
      </div>

      <Button onClick={save} disabled={saving || !name.trim() || !body.trim()}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-2">
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving…' : 'Save Script'}
      </Button>
    </div>
  );
}