/**
 * CloudFunctionPicker — compact dropdown that lets any page load a Cloud
 * Function by clicking a button. Calls `onSelect(fn)` with the full record
 * ({ id, name, description, script, runtime, tags }).
 *
 * Hidden entirely when the CloudFunction entity is not deployed to the
 * Base44 app, so pages don't render a broken-looking empty dropdown. Every
 * surface (StagehandAI, BulkTest ScriptEditor, etc.) shares the same
 * unavailable state through useCloudFunctions's module-level cache.
 */
import { useState } from 'react';
import { useCloudFunctions } from '@/lib/useCloudFunctions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Terminal, ChevronDown, Loader2 } from 'lucide-react';

/**
 * Render a dropdown trigger button that lets the user select a saved Cloud Function.
 *
 * @param {Object} props
 * @param {(fn: {id: string, name: string, description?: string, script: string, runtime?: string, tags?: string[]}) => void} props.onSelect - Callback invoked with the full Cloud Function record when an item is chosen.
 * @param {string} [props.label='Load Cloud Function'] - Text displayed on the trigger button.
 * @param {string} [props.className=''] - Additional CSS classes to apply to the trigger button.
 * @returns {JSX.Element|null} The dropdown menu element, or `null` when the CloudFunction entity is unavailable.
 */
export default function CloudFunctionPicker({
  onSelect,
  label = 'Load Cloud Function',
  className = '',
}) {
  const { items, loading, unavailable, error, retry } = useCloudFunctions();
  const [open, setOpen] = useState(false);

  // Hide entirely only when the entity is undeployed (permanent state).
  // Transient errors keep the picker visible so the user can hit Retry.
  if (unavailable) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`gap-1.5 border-cyan-500/30 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200 ${className}`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-xs">{label}</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-gray-900 border-gray-800 text-gray-200 min-w-[260px] max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
          Cloud Functions
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="px-2 py-3 space-y-2">
            <div className="text-xs text-red-300">{error?.message || 'Failed to load'}</div>
            <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); retry(); }}
              className="h-6 text-xs text-cyan-300 hover:bg-cyan-500/10 px-2">
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-gray-600">No cloud functions saved yet.</div>
        ) : (
          items.map((fn) => (
            <DropdownMenuItem
              key={fn.id}
              onClick={() => { onSelect(fn); setOpen(false); }}
              className="flex flex-col items-start gap-0.5 px-2 py-2 cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm text-white truncate flex-1">{fn.name}</span>
                {fn.runtime && (
                  <span className="text-xs font-mono text-cyan-400/70 capitalize">{fn.runtime}</span>
                )}
              </div>
              {fn.description && (
                <span className="text-xs text-gray-500 line-clamp-1">{fn.description}</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}