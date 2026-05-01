import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import MonitoringStatusPill from './MonitoringStatusPill';

/**
 * Shared shell rendered around every provider's section. Provides:
 *   - Header with icon, name, tagline, status pill, "Test Connection" button
 *   - Optional metric strip (e.g. ScrapingBee credits)
 *   - Tabbed body for Live / Recording / Screenshot subsections
 *
 * `tabs` shape: [{ value, label, icon, disabled?, disabledReason?, content }]
 */
export default function ProviderSectionShell({
  Icon,
  name,
  tagline,
  accent = 'emerald',
  status,
  error,
  lastCheckedAt,
  onPing,
  metricStrip,
  diagnostics,
  defaultTab,
  tabs,
}) {
  const tints = {
    emerald: { border: 'border-emerald-500/20', headerBg: 'bg-emerald-500/5', iconBg: 'bg-emerald-500/10 border-emerald-500/30', iconText: 'text-emerald-400' },
    cyan:    { border: 'border-cyan-500/20',    headerBg: 'bg-cyan-500/5',    iconBg: 'bg-cyan-500/10 border-cyan-500/30',    iconText: 'text-cyan-400' },
    amber:   { border: 'border-amber-500/20',   headerBg: 'bg-amber-500/5',   iconBg: 'bg-amber-500/10 border-amber-500/30',   iconText: 'text-amber-400' },
  };
  const t = tints[accent] || tints.emerald;
  const enabledTabs = tabs.filter(Boolean);
  const initialTab = defaultTab || enabledTabs.find((tab) => !tab.disabled)?.value || enabledTabs[0]?.value;

  return (
    <section className={`rounded-2xl border ${t.border} bg-gray-900/80 overflow-hidden`}>
      <header className={`flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 ${t.headerBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl border ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${t.iconText}`} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-wide truncate">{name}</h2>
            <p className="text-xs text-gray-500 truncate">{tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MonitoringStatusPill status={status} error={error} lastCheckedAt={lastCheckedAt} />
          <Button size="sm" variant="outline" onClick={onPing}
            className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'pinging' ? 'animate-spin' : ''}`} />
            Test Connection
          </Button>
        </div>
      </header>

      {(metricStrip || diagnostics) && (
        <div className="px-5 py-2 border-b border-gray-800 bg-gray-950/40 text-xs text-gray-500 flex flex-col gap-1">
          {metricStrip && <div className="flex flex-wrap gap-x-4 gap-y-1">{metricStrip}</div>}
          {diagnostics}
        </div>
      )}

      <div className="p-5">
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="bg-gray-800/60 border border-gray-800">
            {enabledTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={tab.disabled}
                  title={tab.disabled ? tab.disabledReason : ''}
                  className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-xs gap-1.5"
                >
                  {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {enabledTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {tab.disabled ? (
                <div className="text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg p-6 text-center">
                  Not available — {tab.disabledReason}
                </div>
              ) : (
                tab.content
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}