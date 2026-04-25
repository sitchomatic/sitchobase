import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Activity, Target } from 'lucide-react';

const COLORS = ['#f59e0b', '#10b981', '#ef4444'];

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 shadow-xl">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.name || entry.dataKey} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function TestRunSummaryCharts({ stats }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
    >
      <div className="rounded-xl border border-emerald-500/20 bg-gray-900/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white font-mono uppercase">Test Run State</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.statusData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={4} isAnimationActive animationDuration={700}>
                {stats.statusData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-gray-900/80 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white font-mono uppercase">Success Rate Trend</span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{stats.successRate}%</div>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.trendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="testSuccessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} />
              <Tooltip content={<TooltipBox />} />
              <Area type="monotone" dataKey="success" name="Success %" stroke="#22d3ee" fill="url(#testSuccessFill)" strokeWidth={2} isAnimationActive animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}