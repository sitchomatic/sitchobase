import { useState } from 'react';
import { useCredentials } from '@/lib/useCredentials';
import { createSession } from '@/lib/browserbaseApi';
import { base44 } from '@/api/base44Client';
import CredentialsGuard from '@/components/shared/CredentialsGuard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Terminal, Play, Loader2, CheckCircle, AlertCircle, Sparkles, ChevronRight } from 'lucide-react';

const EXAMPLES = [
  'Navigate to google.com and take a screenshot of the homepage',
  'Go to news.ycombinator.com, extract the top 10 story titles and their scores',
  'Open wikipedia.org and find the article about artificial intelligence, then summarize the introduction',
  'Navigate to github.com/trending and list the top 5 trending repositories',
];

export default function StagehandAI() {
  const { credentials, isConfigured } = useCredentials();
  const [prompt, setPrompt] = useState('');
  const [sessionCount, setSessionCount] = useState(1);
  const [region, setRegion] = useState('ap-southeast-1');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [sessions, setSessions] = useState([]);

  if (!isConfigured) return <CredentialsGuard />;

  const execute = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResults([]);
    setSessions([]);

    // First create sessions
    const createdSessions = [];
    for (let i = 0; i < sessionCount; i++) {
      const s = await createSession(credentials.apiKey, {
        projectId: credentials.projectId,
        region,
        userMetadata: { stagehandPrompt: prompt.slice(0, 100), agentRun: 'true' },
      });
      createdSessions.push(s);
    }
    setSessions(createdSessions);

    // Use InvokeLLM to simulate Stagehand-like task decomposition
    const taskPlan = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Stagehand, a browser automation AI. A user wants to execute this task across ${sessionCount} concurrent Browserbase browser sessions:

"${prompt}"

Project ID: ${credentials.projectId}
Sessions created: ${createdSessions.map(s => s.id).join(', ')}

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
      sessionIds: createdSessions.map(s => s.id),
      plan: taskPlan,
      prompt,
      timestamp: new Date().toLocaleTimeString(),
    }]);
    setRunning(false);
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
              <Label className="text-gray-400 text-xs mb-2 block">Automation Prompt</Label>
              <Textarea
                placeholder='e.g. "Navigate to google.com and take a screenshot of the search results for AI news"'
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-200 min-h-[120px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">
                  Concurrent Sessions: <span className="text-purple-400 font-bold">{sessionCount}</span>
                </Label>
                <Slider min={1} max={10} step={1} value={[sessionCount]}
                  onValueChange={([v]) => setSessionCount(v)} />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-200 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {[
                      { value: 'ap-southeast-1', label: 'ap-southeast-1 🇦🇺' },
                      { value: 'us-west-2',      label: 'us-west-2' },
                      { value: 'us-east-1',      label: 'us-east-1' },
                      { value: 'eu-central-1',   label: 'eu-central-1' },
                    ].map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-gray-200">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={execute}
              disabled={running || !prompt.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2"
            >
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

        {/* Examples */}
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">Example Prompts</div>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="w-full text-left text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2.5 flex items-start gap-2 transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm font-semibold text-white mb-3">Created Sessions</div>
              <div className="space-y-1.5">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <code className="text-gray-400 font-mono">{s.id.slice(0, 20)}…</code>
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