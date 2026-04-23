/**
 * Undo toast helper (#43) — shows a 5s "Undo" action toast.
 * Usage: undoToast('Archived 3 sessions', () => unarchive(ids));
 */
import { toast } from 'sonner';

export function undoToast(message, onUndo, { duration = 5000 } = {}) {
  toast(message, {
    duration,
    action: {
      label: 'Undo',
      onClick: () => { try { onUndo?.(); } catch { /* swallow */ } },
    },
  });
}