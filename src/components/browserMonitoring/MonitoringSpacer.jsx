/**
 * Visual divider between provider sections on the Browser Monitoring page.
 */
export default function MonitoringSpacer({ accent = 'gray' }) {
  const map = {
    gray: 'via-gray-700/60',
    emerald: 'via-emerald-500/30',
    cyan: 'via-cyan-500/30',
    amber: 'via-amber-500/30',
  };
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <div className={`flex-1 h-px bg-gradient-to-r from-transparent ${map[accent] || map.gray} to-transparent`} />
      <div className="w-1 h-1 rounded-full bg-gray-600" />
      <div className={`flex-1 h-px bg-gradient-to-r from-transparent ${map[accent] || map.gray} to-transparent`} />
    </div>
  );
}