/**
 * WebhookEventCheckboxes — small reusable list of event-type toggles for the
 * webhook config form.
 */
import { Checkbox } from '@/components/ui/checkbox';

const EVENTS = [
  { id: 'bulk_run_completed', label: 'Run completed', hint: 'Fires whenever a bulk QA run finishes (any status)' },
  { id: 'bulk_run_failed', label: 'Run failed/stopped', hint: 'Only fires when a run ends as failed or stopped' },
  { id: 'consecutive_error_threshold', label: 'Consecutive errors', hint: 'Fires once during a run when N rows fail back-to-back' },
];

export default function WebhookEventCheckboxes({ events, setEvents }) {
  const toggle = (id) => {
    if (events.includes(id)) setEvents(events.filter((e) => e !== id));
    else setEvents([...events, id]);
  };
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400">Events</div>
      {EVENTS.map((e) => (
        <label key={e.id} className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={events.includes(e.id)} onCheckedChange={() => toggle(e.id)} className="mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-gray-200">{e.label}</div>
            <div className="text-[11px] text-gray-600">{e.hint}</div>
          </div>
        </label>
      ))}
    </div>
  );
}