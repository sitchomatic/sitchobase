import { useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { bbClient } from '@/lib/bbClient';
import { base44 } from '@/api/base44Client';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CloudFunctionLibrary from '@/components/stagehand/CloudFunctionLibrary';
import CloudFunctionPicker from '@/components/shared/CloudFunctionPicker';
import SaveAsCloudFunctionDialog from '@/components/shared/SaveAsCloudFunctionDialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, Loader2, CheckCircle, AlertCircle, Sparkles, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { auditLog } from '@/lib/auditLog';

const EXAMPLES = [
  'Navigate to google.com and take a screenshot of the homepage',
  'Go to news.ycombinator.com, extract the top 10 story titles and their scores',
  'Open wikipedia.org and find the article about artificial intelligence, then summarize the introduction',
  'Navigate to github.com/trending and list the top 5 trending repositories',
];

const REGIONS = [
  { value: 'us-west-2',    label: 'us-west-2 🇺🇸' },
  { value: 'us-east-1',    label: 'us-east-1 🇺🇸' },
  { value: 'eu-central-1', label: 'eu-central-1 🇩🇪' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 🇸🇬' },
];

/**
 * UI component for running natural-language browser automations and viewing generated execution plans.
 *
 * Presents a prompt editor with load/save Cloud Function integration, lets the user configure concurrent
 * sessions and region, creates Browserbase sessions, invokes an LLM to generate a structured execution plan,
 * displays created session IDs and the plan, and records an audit entry for each run.
 *
 * @returns {JSX.Element} The Stagehand AI interface.
 */
export default function StagehandAI() {
  const { isConfigured } = useCredentials();
  const [prompt, setPrompt] = useState('');
  const [sessionCount, setSessionCount] = useState(1);
  const [region, setRegion] = useState('us-west-2');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [createdSessions, setCreatedSessions] = useState([]);
  const [saveAsCloudFunctionOpen, setSaveAsCloudFunctionOpen] = useState(false);

  // Used by the Cloud Function Picker above the prompt. Loads the saved
  // function's `script` (or its description as a fallback) into the prompt
  // textarea so the user can re-run a stored natural-language automation.
  const loadCloudFunction = (fn) => {
    const next = fn?.script?.trim() || fn?.description?.trim() || fn?.name || '';
    setPrompt(next);
    toast.success(`Loaded ${fn.name}`);
  };

  const launchCloudFunction = async (item) => {
    loadCloudFunction(item);
  };

  if (!isConfigured) return <CredentialsGuard />;

  const execute = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResults([]);
    setCreatedSessions([]);

    try {
      const sessionResults = await Promise.allSettled(
        Array.from({ length: sessionCount }, () => bbClient.createSession({
          region,
          userMetadata: { stagehandPrompt: prompt.slice(0, 100), agentRun: 'true' },
        }))
      );
      const sessions = sessionResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
      setCreatedSessions(sessions);

      if (sessions.length === 0) {
        toast.error('Failed to create sessions');
        return;
      }

      // Use LLM to generate the execution plan
      const taskPlan = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Stagehand, a browser automation AI. A user wants to execute this task across ${sessions.length} concurrent Browserbase browser sessions:

"${prompt}"

Sessions created: ${sessions.map(s => s.id).join(', ')}
Region: ${region}

Please provide:
1. Step-by-step breakdown of the automation plan
2. What each browser session would do
3. Expected output/result
4. Any potential issues or rate limits to be aware of

Be specific and technical. Format as a structured execution plan.`,
        response_json_schema: {
          type: 'object',
          properties: {
            steps: { type: 'array', items: { type: 'string' } },
            sessionInstructions: { type: 'array', items: { type: 'object', properties: { sessionIndex: { type: 'number' }, task: { type: 'string' } } } },
            expectedOutput: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
            estimatedDuration: { type: 'string' },
          },
        },
      });

      setResults([{
        sessionIds: sessions.map(s => s.id),
        plan: taskPlan,
        prompt,
        timestamp: new Date().toLocaleTimeString(),
      }]);
      toast.success(`${sessions.length} sessions created with execution plan`);
      auditLog({ action: 'STAGEHAND_RUN', category: 'session', details: { sessionCount: sessions.length, region, promptPreview: prompt.slice(0, 80) } });
    } catch (err) {
      toast.error(`Stagehand run failed: ${err?.message || 'unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" /> Stagehand AI
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Natural language browser automation across concurrent sessions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-400 text-xs">Automation Prompt</Label>
                <div className="flex items-center gap-1.5">
                  <CloudFunctionPicker onSelect={loadCloudFunction} label="Load" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!prompt.trim()}
                    onClick={() => setSaveAsCloudFunctionOpen(true)}
                    className="gap-1.5 border-purple-500/30 bg-purple-500/5 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 disabled:opacity-40"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="text-xs">Save</span>
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder='e.g. "Navigate to google.com and take a screenshot of the search results for AI news"'
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200 min-h-[120px] resize-none"
              />
            </div>

            <SaveAsCloudFunctionDialog
              open={saveAsCloudFunctionOpen}
              onOpenChange={setSaveAsCloudFunctionOpen}
              scriptBody={prompt}
              defaultRuntime="playwright"
              defaultName={prompt.trim().slice(0, 40)}
              title="Save prompt as Cloud Function"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">
                  Concurrent Sessions: <span className="text-purple-400 font-bold">{sessionCount}</span>
                </Label>
                <Slider min={1} max={10} step={1} value={[sessionCount]} onValueChange={([v]) => setSessionCount(v)} />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {REGIONS.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-gray-200">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={execute} disabled={running || !prompt.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Executing…' : `Execute on ${sessionCount} Session${sessionCount > 1 ? 's' : ''}`}
            </Button>
          </div>

          {/* Results */}
          {results.map((r, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Execution Plan
                </div>
                <span className="text-xs text-gray-500">{r.timestamp}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {r.sessionIds.map(id => (
                  <code key={id} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                    {id.slice(0, 12)}…
                  </code>
                ))}
              </div>

              {r.plan?.steps?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Execution Steps</div>
                  <div className="space-y-1.5">
                    {r.plan.steps.map((step, si) => (
                      <div key={si} className="flex items-start gap-2 text-xs">
                        <span className="text-emerald-400 font-bold flex-shrink-0">{si + 1}.</span>
                        <span className="text-gray-300">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.plan?.expectedOutput && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Expected Output</div>
                  <div className="text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-2">{r.plan.expectedOutput}</div>
                </div>
              )}

              {r.plan?.warnings?.length > 0 && (
                <div className="space-y-1">
                  {r.plan.warnings.map((w, wi) => (
                    <div key={wi} className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5">
                      <AlertCircle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-yellow-300">{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {r.plan?.estimatedDuration && (
                <div className="text-xs text-gray-500">
                  Estimated duration: <span className="text-gray-300">{r.plan.estimatedDuration}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <CloudFunctionLibrary onLaunch={launchCloudFunction} />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">Example Prompts</div>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => setPrompt(ex)}
                  className="w-full text-left text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2.5 flex items-start gap-2 transition-colors">
                  <ChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {createdSessions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm font-semibold text-white mb-3">Created Sessions</div>
              <div className="space-y-1.5">
                {createdSessions.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <code className="text-gray-400 font-mono truncate">{s.id}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}