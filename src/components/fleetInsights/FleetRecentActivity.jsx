import { motion } from 'framer-motion';

const statusTone = {
  COMPLETED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  RUNNING: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  PENDING: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  ERROR: 'bg-red-500/10 text-red-300 border-red-500/30',
  TIMED_OUT: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export default function FleetRecentActivity({ items }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 text-sm font-bold text-white font-mono uppercase">Recent Activity</div>
      <div className="divide-y divide-gray-800/70">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No recent browser activity yet.</div>
        ) : items.map((item, index) => (
          <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }} className="px-4 py-3 flex items-center gap-3">
            <div className="w-12 text-xs text-gray-500 font-mono">{item.label}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 font-mono truncate">{item.id}</div>
              <div className="text-xs text-gray-600 mt-0.5">{item.region}</div>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-mono ${statusTone[item.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{item.status}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}