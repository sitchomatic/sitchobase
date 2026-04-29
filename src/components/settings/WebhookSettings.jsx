/**
 * WebhookSettings — panel inside /settings to manage outbound webhooks for
 * bulk QA lifecycle events. Supports create / edit / delete / enable /
 * "send test" without leaving the page.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Webhook, Plus, Trash2, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendTestWebhook, invalidateWebhookCache } from '@/lib/webhookDispatcher';
import WebhookEventCheckboxes from '@/components/settings/WebhookEventCheckboxes';

const EMPTY = {
  name: '',
  url: '',
  secret: '',
  events: ['bulk_run_completed', 'bulk_run_failed'],
  consecutiveErrorThreshold: 5,
  enabled: true,
};

export default function WebhookSettings() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.WebhookConfig.list('-updated_date', 50);
      setConfigs(Array.isArray(list) ? list : []);
      setUnavailable(false);
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 404) setUnavailable(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (cfg) => {
    setEditingId(cfg.id);
    setDraft({
      name: cfg.name || '',
      url: cfg.url || '',
      secret: cfg.secret || '',
      events: Array.isArray(cfg.events) ? cfg.events : [],
      consecutiveErrorThreshold: cfg.consecutiveErrorThreshold ?? 5,
      enabled: cfg.enabled !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY);
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    if (!/^https?:\/\//i.test(draft.url.trim())) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    const payload = {
      ...draft,
      name: draft.name.trim(),
      url: draft.url.trim(),
      secret: draft.secret.trim(),
    };
    try {
      if (editingId) await base44.entities.WebhookConfig.update(editingId, payload);
      else await base44.entities.WebhookConfig.create(payload);
      invalidateWebhookCache();
      toast.success(editingId ? 'Webhook updated' : 'Webhook created');
      cancelEdit();
      await load();
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    await base44.entities.WebhookConfig.delete(id);
    invalidateWebhookCache();
    toast.success('Webhook deleted');
    if (editingId === id) cancelEdit();
    await load();
  };

  const toggle = async (cfg) => {
    await base44.entities.WebhookConfig.update(cfg.id, { enabled: !cfg.enabled });
    invalidateWebhookCache();
    await load();
  };

  const sendTest = async (cfg) => {
    setTestingId(cfg.id);
    const res = await sendTestWebhook(cfg);
    setTestingId(null);
    if (res.ok) toast.success(`Test sent · ${res.status}`);
    else toast.error(`Test failed · ${res.error || res.status}`);
    await load();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Webhook className="w-4 h-4 text-cyan-400" /> Outbound Webhooks
        </div>
        {!unavailable && !editingId && (
          <Button size="sm" variant="ghost" onClick={() => setDraft(EMPTY) || setEditingId('new')}
            className="text-cyan-400 hover:bg-cyan-500/10 gap-1">
            <Plus className="w-3 h-3" /> New
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        POST a JSON payload to your URL when bulk QA runs complete, fail, or hit a streak of consecutive failures. Configure separately for Slack, Discord, or your own endpoints.
      </p>

      {unavailable && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-200">
          The <code className="bg-yellow-500/10 px-1 rounded">WebhookConfig</code> entity is not deployed yet.
        </div>
      )}

      {loading && !unavailable && (
        <div className="text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
      )}

      {!loading && !unavailable && configs.length === 0 && editingId !== 'new' && (
        <div className="text-xs text-gray-600 text-center py-4">No webhooks configured</div>
      )}

      {!unavailable && configs.map((cfg) => (
        <div key={cfg.id} className="rounded-lg border border-gray-800 bg-gray-800/40 p-3 space-y-2">
          {editingId === cfg.id ? (
            <DraftForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancelEdit} saving={saving} />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium flex items-center gap-2">
                    {cfg.name}
                    {cfg.enabled === false && <span className="text-[10px] uppercase text-gray-500">disabled</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate font-mono">{cfg.url}</div>
                  <div className="text-[11px] text-gray-600 mt-1 flex flex-wrap gap-1">
                    {(cfg.events || []).map((e) => (
                      <span key={e} className="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-cyan-300">{e}</span>
                    ))}
                  </div>
                  {cfg.lastStatus && (
                    <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
                      {cfg.lastError ? <AlertCircle className="w-3 h-3 text-red-400" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                      Last: {cfg.lastStatus}{cfg.lastError ? ` · ${cfg.lastError}` : ''}
                    </div>
                  )}
                </div>
                <Switch checked={cfg.enabled !== false} onCheckedChange={() => toggle(cfg)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(cfg)} className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs">Edit</Button>
                <Button size="sm" variant="outline" onClick={() => sendTest(cfg)} disabled={testingId === cfg.id}
                  className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs gap-1">
                  {testingId === cfg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send test
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(cfg.id)} className="border-red-800 text-red-400 hover:bg-red-500/10 text-xs gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

      {editingId === 'new' && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
          <DraftForm draft={draft} setDraft={setDraft} onSave={save} onCancel={cancelEdit} saving={saving} />
        </div>
      )}
    </div>
  );
}

function DraftForm({ draft, setDraft, onSave, onCancel, saving }) {
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
        <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Slack #qa-alerts" className="bg-gray-800 border-gray-700 text-gray-200" />
      </div>
      <div>
        <Label className="text-xs text-gray-400 mb-1 block">URL</Label>
        <Input value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://hooks.slack.com/services/..." className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
      <div>
        <Label className="text-xs text-gray-400 mb-1 block">Shared secret (optional)</Label>
        <Input value={draft.secret} onChange={(e) => set('secret', e.target.value)} placeholder="Sent as X-Webhook-Secret header" className="bg-gray-800 border-gray-700 text-gray-200 font-mono text-xs" />
      </div>
      <WebhookEventCheckboxes events={draft.events} setEvents={(events) => set('events', events)} />
      {draft.events.includes('consecutive_error_threshold') && (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Consecutive error threshold</Label>
          <Input type="number" min={2} max={50} value={draft.consecutiveErrorThreshold}
            onChange={(e) => set('consecutiveErrorThreshold', Math.max(2, Math.min(50, parseInt(e.target.value) || 5)))}
            className="bg-gray-800 border-gray-700 text-gray-200 w-32" />
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Switch checked={draft.enabled} onCheckedChange={(v) => set('enabled', v)} />
        <span className="text-xs text-gray-400">Enabled</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600 text-black">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="border-gray-700 text-gray-300">Cancel</Button>
      </div>
    </div>
  );
}