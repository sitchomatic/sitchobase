/**
 * ProviderSpacer — visual divider between provider sections on the
 * Live Look-In page. Keeps each provider clearly demarcated as the
 * user requested (Browserbase / Browserless / ScrapingBee).
 */
export default function ProviderSpacer({ accent = 'emerald' }) {
  const accentMap = {
    emerald: 'via-emerald-500/30',
    cyan: 'via-cyan-500/30',
    amber: 'via-amber-500/30',
  };
  return (
    <div className="my-8 flex items-center gap-3" aria-hidden>
      <div className={`flex-1 h-px bg-gradient-to-r from-transparent ${accentMap[accent] || accentMap.emerald} to-transparent`} />
      <div className={`w-1.5 h-1.5 rounded-full bg-${accent}-400/60`} />
      <div className={`flex-1 h-px bg-gradient-to-r from-transparent ${accentMap[accent] || accentMap.emerald} to-transparent`} />
    </div>
  );
}