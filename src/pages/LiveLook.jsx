/**
 * LiveLook — dedicated "Live Look-In / Recordings / Screenshots" page.
 *
 * One section per third-party browser-automation provider attached to
 * this project, each clearly separated with a ProviderSpacer:
 *
 *   1. Browserbase  — live debugger iframe for RUNNING sessions
 *                     (GET /v1/sessions/:id/debug → debuggerFullscreenUrl)
 *                     plus a deep-link to the post-session Inspector replay.
 *   2. Browserless  — BrowserQL `liveURL` mutation for an interactive,
 *                     embeddable live stream of any URL on demand.
 *   3. ScrapingBee  — HTML API `screenshot` / `screenshot_full_page`
 *                     parameter for one-shot captures of any URL.
 *
 * All three providers go through a single backend function (`liveLook`)
 * which keeps API keys server-side and returns sanitised results.
 */
import { Eye } from 'lucide-react';
import BrowserbaseLivePanel from '@/components/liveLook/BrowserbaseLivePanel';
import BrowserlessLivePanel from '@/components/liveLook/BrowserlessLivePanel';
import ScrapingBeeScreenshotPanel from '@/components/liveLook/ScrapingBeeScreenshotPanel';
import ProviderSpacer from '@/components/liveLook/ProviderSpacer';

export default function LiveLook() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <header>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-emerald-400" /> Live Look-In, Recordings & Screenshots
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Watch running automations, mint shareable live streams, and capture on-demand screenshots — across every browser-automation provider attached to this project.
        </p>
      </header>

      <BrowserbaseLivePanel />
      <ProviderSpacer accent="cyan" />
      <BrowserlessLivePanel />
      <ProviderSpacer accent="amber" />
      <ScrapingBeeScreenshotPanel />
    </div>
  );
}