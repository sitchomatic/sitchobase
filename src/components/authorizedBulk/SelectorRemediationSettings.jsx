import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSelectorAdjustmentSuggestions } from '@/lib/authorizedBulkSelectorSuggestions';

export default function SelectorRemediationSettings({ parentRun, failedRows, value, onChange, disabled }) {
  const suggestions = getSelectorAdjustmentSuggestions(parentRun, failedRows);
  const applySuggestion = (field, suggested) => onChange({ ...value, [field]: suggested });

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500">Step 3 · Correct selector configuration</div>
        <div className="text-[11px] text-gray-500 mt-1">
          Suggested selector adjustments are based on the failed row outcomes. Apply them, edit manually, then re-run only the selected failed rows.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {suggestions.map((item) => (
          <div key={item.field} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-gray-300">{item.label}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || value[item.field] === item.suggested}
                onClick={() => applySuggestion(item.field, item.suggested)}
                className="h-7 text-cyan-300 hover:text-cyan-200"
              >
                <Wand2 className="w-3 h-3" /> Apply suggestion
              </Button>
            </div>
            <Input
              value={value[item.field] || ''}
              onChange={(e) => onChange({ ...value, [item.field]: e.target.value })}
              disabled={disabled}
              className="bg-gray-950 border-gray-800 text-gray-100 font-mono text-xs"
            />
            <div className="rounded border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] text-cyan-100/80">
              <div className="text-cyan-300 font-semibold mb-1">Suggestion</div>
              <div className="font-mono break-all text-gray-300">{item.suggested}</div>
              <div className="mt-1 text-gray-500">{item.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}