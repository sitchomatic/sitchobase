/**
 * Browser Monitoring — dedicated page that surfaces Live Look-In,
 * Recordings, and Screenshots across every browser-automation provider
 * detected in this codebase.
 *
 * Detected providers (see Step 1 of the build plan):
 *   • Browserbase  (Api_key secret + bbProxy/bbClient + browserbaseUrls)
 *   • Browserless  (BROWSERLESS_API_KEY secret)
 *   • ScrapingBee  (SCRAPINGBEE_API_KEY secret)
 *
 * Each section is rendered via a shared ProviderSectionShell that carries
 * the Connection Test + Status pill, and exposes Live / Recording / Screenshot
 * tabs — capabilities not supported by a provider are rendered as disabled
 * tabs with a clear explanation, never hidden.
 */
import { Telescope } from 'lucide-react';
import BrowserbaseSection from '@/components/browserMonitoring/BrowserbaseSection';
import BrowserlessSection from '@/components/browserMonitoring/BrowserlessSection';
import ScrapingBeeSection from '@/components/browserMonitoring/ScrapingBeeSection';
import MonitoringSpacer from '@/components/browserMonitoring/MonitoringSpacer';
import LogExportPanel from '@/components/browserMonitoring/LogExportPanel';

export default function BrowserMonitoring() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Telescope className="w-5 h-5 text-emerald-400" /> Browser Monitoring
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Live Look-In, Recordings, and Screenshots across every browser-automation provider in this project. Use <span className="text-gray-300">Test Connection</span> on each section to confirm credentials before running a capture.
        </p>
      </header>

      <BrowserbaseSection />
      <MonitoringSpacer accent="emerald" />
      <BrowserlessSection />
      <MonitoringSpacer accent="cyan" />
      <ScrapingBeeSection />
      <MonitoringSpacer accent="amber" />
      <LogExportPanel />
    </div>
  );
}