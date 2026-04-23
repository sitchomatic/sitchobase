/**
 * useConfirm — standardized destructive-action confirmation (#42).
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const onDelete = async () => {
 *     if (await confirm({ title: 'Delete?', description: 'Cannot be undone.' })) {
 *       doDelete();
 *     }
 *   };
 *   return (<>...<ConfirmDialog /></>);
 */
import { useState, useCallback, useRef } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState({ title: '', description: '', confirmText: 'Confirm', variant: 'destructive' });
  const resolveRef = useRef(null);

  const confirm = useCallback((o = {}) => {
    setOpts({ title: 'Are you sure?', description: '', confirmText: 'Confirm', variant: 'destructive', ...o });
    setOpen(true);
    return new Promise((resolve) => { resolveRef.current = resolve; });
  }, []);

  const handle = (result) => {
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  const ConfirmDialog = () => (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handle(false); }}>
      <AlertDialogContent className="bg-gray-900 border-gray-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{opts.title}</AlertDialogTitle>
          {opts.description && (
            <AlertDialogDescription className="text-gray-400">{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handle(false)}
            className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handle(true)}
            className={opts.variant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 text-black'}>
            {opts.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}