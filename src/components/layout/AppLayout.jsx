import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { rootPathFor } from '@/lib/routing';
import { pageTransition, pageVariants } from '@/lib/motion';
import { useAuth } from '@/lib/AuthContext';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import FleetAlertBadge from '@/components/layout/FleetAlertBadge';
import LiveAuditStream from '@/components/shared/LiveAuditStream';
import UserMenu from '@/components/shared/UserMenu';
import {
  LayoutGrid, Activity, Layers, Users, Settings,
  Zap, Globe, Network, Terminal, FlaskConical, Radio, Shield, BarChart3, HeartPulse,
  BookOpen, Flag, Clock, ScrollText, Bug, Wrench, Sparkles, KeyRound, Telescope,
  Stethoscope, ChevronDown, ChevronRight, Eye,
} from 'lucide-react';

/**
 * Sidebar grouping. Each section is collapsible. Order is the operator's
 * mental model: Run → Observe → Diagnose → Manage → Help.
 *
 * Pages that used to be top-level but are now subviews of another page
 * (Proxy Efficiency, NordLynx, QA History, etc.) are deliberately not in
 * this list — they're reachable from their parent page.
 */
const NAV_GROUPS = [
  {
    id: 'run',
    label: 'Run',
    items: [
      { label: 'Command Center', icon: LayoutGrid, path: '/' },
      { label: 'Fleet Launcher', icon: Zap, path: '/fleet' },
      { label: 'AU Casino', icon: Sparkles, path: '/au-casino' },
      { label: 'AU Dual Validation', icon: FlaskConical, path: '/au-casino/dual-validation' },
      { label: 'Authorized QA', icon: FlaskConical, path: '/bulk' },
      { label: 'Stagehand AI', icon: Terminal, path: '/stagehand' },
      { label: 'Mirror Mode', icon: Eye, path: '/mirror' },
    ],
  },
  {
    id: 'observe',
    label: 'Observe',
    items: [
      { label: 'Live Sessions', icon: Activity, path: '/sessions' },
      { label: 'Browser Monitoring', icon: Telescope, path: '/monitoring' },
      { label: 'RT Monitor', icon: Radio, path: '/monitor' },
      { label: 'Fleet Insights', icon: BarChart3, path: '/fleet/insights' },
      { label: 'Test Reports', icon: BarChart3, path: '/reports' },
      { label: 'QA History', icon: Clock, path: '/bulk/runs' },
    ],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    items: [
      { label: 'Diagnostics', icon: Stethoscope, path: '/diagnostics' },
      { label: 'Failure Analytics', icon: BarChart3, path: '/diagnostics/failures' },
      { label: 'Health', icon: HeartPulse, path: '/health' },
      { label: 'Audit Log', icon: ScrollText, path: '/audit' },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    items: [
      { label: 'AU Credentials', icon: KeyRound, path: '/au-casino/credentials' },
      { label: 'Proxies', icon: Shield, path: '/proxies' },
      { label: 'Proxy Health', icon: Activity, path: '/proxies/health' },
      { label: 'Contexts', icon: Layers, path: '/contexts' },
      { label: 'Personas', icon: Users, path: '/personas' },
      { label: 'Analytics', icon: Network, path: '/analytics' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { label: 'Runbook', icon: BookOpen, path: '/help/runbook' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

const ADMIN_GROUP = {
  id: 'admin',
  label: 'Admin',
  items: [
    { label: 'Metrics', icon: BarChart3, path: '/admin/metrics' },
    { label: 'Slow Calls', icon: Clock, path: '/admin/slow' },
    { label: 'Frontend Errors', icon: Bug, path: '/admin/errors' },
    { label: 'Operations', icon: Wrench, path: '/admin/operations' },
    { label: 'Feature Flags', icon: Flag, path: '/admin/flags' },
    { label: 'Self-Test', icon: HeartPulse, path: '/admin/self-test' },
  ],
};

function NavGroup({ group, activePath, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-300 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {group.label}
      </button>
      {open && group.items.map(({ label, icon: Icon, path }) => {
        const active = activePath === path;
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              active
                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </Link>
        );
      })}
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';
  const activePath = rootPathFor(location.pathname);
  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Globe className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">BB Command</div>
              <div className="text-xs text-gray-500">Center</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
          {groups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              activePath={activePath}
              // Open the group that contains the active route by default,
              // plus 'Run' as the universal entry point.
              defaultOpen={group.id === 'run' || group.items.some((i) => i.path === activePath)}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <UserMenu />
          <div className="flex justify-center">
            <FleetAlertBadge />
          </div>
          <div className="text-xs text-gray-600 text-center">Browserbase API v1</div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-[env(safe-area-inset-top)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activePath}
            {...pageVariants()}
            transition={pageTransition()}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <LiveAuditStream />
      <MobileBottomNav />
    </div>
  );
}