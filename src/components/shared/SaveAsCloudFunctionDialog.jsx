/**
 * SaveAsCloudFunctionDialog — shared dialog any page can open to persist
 * an arbitrary prompt/script body as a Cloud Function. Takes the body as a
 * prop so each integration site controls what "save this" means (a prompt
 * on Stagehand, a Playwright script in BulkTest, etc.) without duplicating
 * the form + error handling.
 *
 * Automatically reflects the entity-missing state from useCloudFunctions:
 * when the CloudFunction entity isn't deployed, attempting to save surfaces
 * a single clear toast instead of bouncing a 500 at the user.
 */
import { useState, useEffect } from 'react';
import { useCloudFunctions } from '@/lib/useCloudFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Render a controlled dialog that lets the user save a script or prompt as a Cloud Function.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.open - Whether the dialog is open.
 * @param {(open: boolean) => void} props.onOpenChange - Callback invoked when the dialog open state should change.
 * @param {string} props.scriptBody - Initial script or prompt body to edit and save.
 * @param {string} [props.defaultRuntime='playwright'] - Initial runtime selection (`"playwright"` or `"puppeteer"`).
 * @param {string} [props.defaultName=''] - Initial name for the Cloud Function.
 * @param {string} [props.defaultDescription=''] - Initial description for the Cloud Function.
 * @param {string} [props.title='Save as Cloud Function'] - Dialog title text.
 * @param {(saved: any) => void} [props.onSaved] - Optional callback invoked with the saved function object after a successful save.
 * @returns {JSX.Element} A dialog UI that contains form fields for name, runtime, description, and script body, and a button to save the Cloud Function.
 */
export default function SaveAsCloudFunctionDialog({
  open,
  onOpenChange,
  scriptBody,
  defaultRuntime = 'playwright',
  defaultName = '',
  defaultDescription = '',
  title = 'Save as Cloud Function',
  onSaved,
}) {
  const { saveFunction, unavailable } = useCloudFunctions({ autoload: false });
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [runtime, setRuntime] = useState(defaultRuntime);
  const [body, setBody] = useState(scriptBody ?? '');
  const [saving, setSaving] = useState(false);

  // Reset local state whenever the dialog is opened so previous runs don't
  // leak into the form.
  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription(defaultDescription);
    setRuntime(defaultRuntime);
    setBody(scriptBody ?? '');
  }, [open, defaultName, defaultDescription, defaultRuntime, scriptBody]);

  const submit = async () => {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const saved = await saveFunction({
        name: name.trim(),
        description: description.trim() || undefined,
        script: body,
        runtime,
      });
      toast.success(`Cloud function “${saved.name}” saved`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      if (err?.entityMissing) {
        toast.error('Cloud Functions entity is not deployed to this Base44 app');
      } else {
        toast.error(`Save failed: ${err?.message || 'unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-300">
            <Save className="w-4 h-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        {unavailable && (
          <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/90">
            The <code className="text-yellow-100 bg-yellow-500/10 px-1 rounded">CloudFunction</code> entity is not deployed to this Base44 app. Publishing{' '}
            <code className="text-yellow-100 bg-yellow-500/10 px-1 rounded">base44/entities/CloudFunction.jsonc</code> via the Base44 Builder will enable saving.
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HN scraper"
                className="bg-gray-800 border-gray-700 text-gray-200"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Runtime</Label>
              <Select value={runtime} onValueChange={setRuntime}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-gray-200">
                  <SelectItem value="playwright">playwright</SelectItem>
                  <SelectItem value="puppeteer">puppeteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this function do?"
              className="bg-gray-800 border-gray-700 text-gray-200"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Script / prompt body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="bg-gray-800 border-gray-700 text-gray-200 min-h-[180px] font-mono text-xs"
            />
          </div>
          <Button
            onClick={submit}
            disabled={saving || !name.trim() || !body.trim() || unavailable}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              'Save Cloud Function'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
