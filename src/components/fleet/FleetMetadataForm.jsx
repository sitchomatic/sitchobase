import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITY_LEVELS } from '@/components/fleet/FleetLaunchPresets';

export default function FleetMetadataForm({ metadata, setMetadata }) {
  const update = (key, value) => setMetadata((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-gray-300">userMetadata</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-gray-500 text-[11px] mb-1 block">testRun</Label>
          <Input value={metadata.testRun} onChange={e => update('testRun', e.target.value)}
            placeholder="e.g. run-42" className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-gray-500 text-[11px] mb-1 block">variant</Label>
          <Input value={metadata.variant} onChange={e => update('variant', e.target.value)}
            placeholder="e.g. control-A" className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-gray-500 text-[11px] mb-1 block">priority</Label>
          <Select value={metadata.priority} onValueChange={v => update('priority', v)}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {PRIORITY_LEVELS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-gray-200">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-gray-500 text-[11px] mb-1 block">task (Stagehand)</Label>
          <Input value={metadata.task} onChange={e => update('task', e.target.value)}
            placeholder="NL prompt/task" className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-xs" />
        </div>
      </div>
    </div>
  );
}