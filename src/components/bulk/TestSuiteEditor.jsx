import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Layers, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function TestSuiteEditor({ suite, scripts, onSave, onCancel }) {
  const [name, setName] = useState(suite?.name || '');
  const [description, setDescription] = useState(suite?.description || '');
  const [scenarioIds, setScenarioIds] = useState(suite?.scenarioIds || []);
  const [saving, setSaving] = useState(false);

  const selectedScripts = useMemo(
    () => scripts.filter(script => scenarioIds.includes(script.id)),
    [scripts, scenarioIds]
  );

  const toggleScenario = (scriptId) => {
    setScenarioIds((prev) => prev.includes(scriptId)
      ? prev.filter(id => id !== scriptId)
      : [...prev, scriptId]);
  };

  const handleSave = async () => {
    if (!name.trim() || scenarioIds.length === 0) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      scenarioIds,
    };
    const saved = suite?.id
      ? await base44.entities.TestSuite.update(suite.id, payload)
      : await base44.entities.TestSuite.create(payload);
    toast.success('Test suite saved');
    onSave(saved);
    setSaving(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Layers className="w-4 h-4 text-cyan-400" />
          {suite?.id ? 'Edit Test Suite' : 'New Test Suite'}
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel} className="text-gray-500 hover:text-gray-200">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Suite Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-800 border-gray-700 text-gray-200" />
      </div>

      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-gray-800 border-gray-700 text-gray-200" />
      </div>

      <div className="space-y-2">
        <Label className="text-gray-400 text-xs block">Scenario Sequence</Label>
        <ScrollArea className="h-48 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
          <div className="space-y-2">
            {scripts.map((script) => (
              <label key={script.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-800/60 cursor-pointer">
                <Checkbox checked={scenarioIds.includes(script.id)} onCheckedChange={() => toggleScenario(script.id)} />
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{script.name}</div>
                  <div className="text-xs text-gray-500 truncate">{script.description || 'No description'}</div>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>

      {selectedScripts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedScripts.map((script, index) => (
            <Badge key={script.id} className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
              {index + 1}. {script.name}
            </Badge>
          ))}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving || !name.trim() || scenarioIds.length === 0} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold gap-2">
        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Test Suite'}
      </Button>
    </div>
  );
}