import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { rootPathFor } from '@/lib/routing';
import { pageTransition, pageVariants } from '@/lib/motion';
import { useAuth } from '@/lib/AuthContext';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import FleetAlertBadge from '@/components/layout/FleetAlertBadge';
import LiveAuditStream from '@/components/shared/LiveAuditStream';
import {
  LayoutGrid, Activity, Layers, Users, Settings,
  Zap, Globe, Network, Eye, Terminal, FlaskConical, Radio, Shield, BarChart3, HeartPulse, BookOpen, Flag, Clock, Route
} from 'lucide-react';

const navItems = [
  { label: 'Command Center', icon: LayoutGrid, path: '/' },
  { label: 'Fleet Launcher', icon: Zap, path: '/fleet' },
  { label: 'Fleet Insights', icon: BarChart3, path: '/fleet/insights' },
  { label: 'Authorized QA', icon: FlaskConical, path: '/bulk' },
  { label: 'QA History', icon: Clock, path: '/bulk/runs' },
  { label: 'Live Sessions', icon: Activity, path: '/sessions' },
  { label: 'Test Reports', icon: BarChart3, path: '/reports' },
  { label: 'RT Monitor', icon: Radio, path: '/monitor' },
  { label: 'Mirror Mode', icon: Eye, path: '/mirror' },
  { label: 'Contexts', icon: Layers, path: '/contexts' },
  { label: 'Proxies', icon: Shield, path: '/proxies' },
  { label: 'Proxy Efficiency', icon: BarChart3, path: '/proxies/efficiency' },
  { label: 'NordLynx Proxy', icon: Route, path: '/proxies/nordlynx' },
  { label: 'Personas', icon: Users, path: '/personas' },
  { label: 'Analytics', icon: Network, path: '/analytics' },
  { label: 'Stagehand AI', icon: Terminal, path: '/stagehand' },
  { label: 'Audit Log', icon: Shield, path: '/audit' },
  { label: 'Status', icon: HeartPulse, path: '/status' },
  { label: 'Runbook', icon: BookOpen, path: '/help/runbook' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

// Admin-only entries are appended when the user has role === 'admin'.
const adminNavItems = [
  { label: 'Metrics', icon: BarChart3, path: '/admin/metrics' },
  { label: 'Slow Calls', icon: Clock, path: '/admin/slow' },
  { label: 'Feature Flags', icon: Flag, path: '/admin/flags' },
  { label: 'Self-Test', icon: Shield, path: '/admin/self-test' },
];

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
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

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {items.map(({ label, icon: Icon, path }) => {
            const active = rootPathFor(location.pathname) === path;
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
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <div className="flex justify-center">
            <FleetAlertBadge />
          </div>
          <div className="text-xs text-gray-600 text-center">Browserbase API v1</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-[env(safe-area-inset-top)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={rootPathFor(location.pathname)}
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