import { useState } from 'react';
import { Camera, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getAutomationObservabilitySettings, saveAutomationObservabilitySettings } from '@/lib/automationObservability';
import { toast } from 'sonner';

export default function AutomationObservabilitySettings() {
  const [settings, setSettings] = useState(getAutomationObservabilitySettings);

  const save = () => {
    saveAutomationObservabilitySettings(settings);
    toast.success('Automation observability settings saved');
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="text-sm font-semibold text-white flex items-center gap-2">
        <Camera className="w-4 h-4 text-orange-400" /> Automation Evidence
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5">
        <div>
          <Label className="text-gray-300 text-sm flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-emerald-400" /> Show video recording links
          </Label>
          <p className="text-xs text-gray-600 mt-0.5">Links each automated session to the Browserbase session inspector.</p>
        </div>
        <Switch checked={settings.enableVideoRecording} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableVideoRecording: checked }))} />
      </div>
      <div>
        <Label className="text-gray-400 text-xs mb-1.5 block">Screenshot log verbosity</Label>
        <Select value={settings.logVerbosityLevel} onValueChange={(value) => setSettings((prev) => ({ ...prev, logVerbosityLevel: value }))}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low — failures only</SelectItem>
            <SelectItem value="high">High — every major step</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">Save Evidence Settings</Button>
    </div>
  );
}