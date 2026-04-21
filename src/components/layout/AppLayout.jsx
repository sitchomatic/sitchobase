import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import {
  LayoutGrid, Activity, Layers, Users, Settings,
  Zap, Globe, Network, Eye, Terminal, FlaskConical, Radio, Shield
} from 'lucide-react';

const navItems = [
  { label: 'Command Center', icon: LayoutGrid, path: '/' },
  { label: 'Fleet Launcher', icon: Zap, path: '/fleet' },
  { label: 'Bulk Test', icon: FlaskConical, path: '/bulk' },
  { label: 'Live Sessions', icon: Activity, path: '/sessions' },
  { label: 'RT Monitor', icon: Radio, path: '/monitor' },
  { label: 'Mirror Mode', icon: Eye, path: '/mirror' },
  { label: 'Contexts', icon: Layers, path: '/contexts' },
  { label: 'Personas', icon: Users, path: '/personas' },
  { label: 'Analytics', icon: Network, path: '/analytics' },
  { label: 'Stagehand AI', icon: Terminal, path: '/stagehand' },
  { label: 'Audit Log', icon: Shield, path: '/audit' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();

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
          {navItems.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
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

        <div className="p-3 border-t border-gray-800">
          <div className="text-xs text-gray-600 text-center">Browserbase API v1</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-[env(safe-area-inset-top)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ x: isMobile ? 24 : 0, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isMobile ? -24 : 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileBottomNav />
    </div>
  );
}