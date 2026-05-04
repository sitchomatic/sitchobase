import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RETRY_FAILURE_TYPES } from '@/lib/authorizedBulkRetryPolicy';

const RETRYABLE_OPTIONS = ['network_timeout', 'transient_network', 'unknown'];

export default function RetryPolicySettings({ value, onChange, disabled }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const toggleFailureType = (type) => {
    const current = value.retryableFailureTypes || [];
    update({
      retryableFailureTypes: current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    });
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold text-gray-200">Retry policy</div>
        <p className="text-xs text-gray-500 mt-0.5">Retry only selected transient failures; permanent setup issues are sent to review.</p>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-300">
        <Checkbox checked={value.enabled} onCheckedChange={(checked) => update({ enabled: Boolean(checked) })} disabled={disabled} />
        Enable exponential backoff retries
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-400 mb-2 block">Max retries</Label>
          <Input type="number" min="0" max="5" value={value.maxRetries} onChange={(e) => update({ maxRetries: Number(e.target.value) })} disabled={disabled} className="bg-gray-950 border-gray-800 text-gray-100" />
        </div>
        <div>
          <Label className="text-xs text-gray-400 mb-2 block">Start delay (ms)</Label>
          <Input type="number" min="250" step="250" value={value.initialDelayMs} onChange={(e) => update({ initialDelayMs: Number(e.target.value) })} disabled={disabled} className="bg-gray-950 border-gray-800 text-gray-100" />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-400 mb-2 block">Retry failure types</Label>
        <div className="space-y-2">
          {RETRYABLE_OPTIONS.map((type) => (
            <label key={type} className="flex items-center gap-2 text-xs text-gray-300">
              <Checkbox checked={(value.retryableFailureTypes || []).includes(type)} onCheckedChange={() => toggleFailureType(type)} disabled={disabled || !value.enabled} />
              {RETRY_FAILURE_TYPES[type]}
            </label>
          ))}
        </div>
        <div className="text-[10px] text-yellow-500 mt-2">Selector/configuration failures are always flagged for human review.</div>
      </div>
    </div>
  );
}