/**
 * Toast dedup wrapper (#45). Prevents spamming identical messages when
 * polling fails repeatedly. Uses sonner's `id` option.
 */
import { toast } from 'sonner';

export function toastOnce(id, kind, message, opts = {}) {
  const fn = toast[kind] || toast;
  return fn(message, { id, ...opts });
}

export const toastError = (id, message, opts) => toastOnce(id, 'error', message, opts);
export const toastSuccess = (id, message, opts) => toastOnce(id, 'success', message, opts);
export const toastInfo = (id, message, opts) => toastOnce(id, 'info', message, opts);