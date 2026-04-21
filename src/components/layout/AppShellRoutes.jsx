import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from '@/pages/Dashboard';
import Sessions from '@/pages/Sessions';
import FleetLauncher from '@/pages/FleetLauncher';
import MirrorMode from '@/pages/MirrorMode';
import Contexts from '@/pages/Contexts';
import Personas from '@/pages/Personas';
import Analytics from '@/pages/Analytics';
import StagehandAI from '@/pages/StagehandAI';
import Settings from '@/pages/Settings';
import BulkTest from '@/pages/BulkTest';
import JoeIgnite from '@/pages/JoeIgnite';
import Monitor from '@/pages/Monitor';
import AuditLog from '@/pages/AuditLog.jsx';
import PageNotFound from '@/lib/PageNotFound';

const routeMap = {
  '/': Dashboard,
  '/sessions': Sessions,
  '/fleet': FleetLauncher,
  '/mirror': MirrorMode,
  '/contexts': Contexts,
  '/personas': Personas,
  '/analytics': Analytics,
  '/stagehand': StagehandAI,
  '/settings': Settings,
  '/bulk': BulkTest,
  '/joe-ignite': JoeIgnite,
  '/monitor': Monitor,
  '/audit': AuditLog,
};

const rootPathFor = (pathname) => {
  if (pathname.startsWith('/sessions')) return '/sessions';
  if (pathname.startsWith('/audit')) return '/audit';
  return Object.keys(routeMap).find((path) => path === pathname) || pathname;
};

export default function AppShellRoutes({ pathname }) {
  const activeRootPath = rootPathFor(pathname);
  const ActiveComponent = routeMap[activeRootPath] || PageNotFound;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeRootPath}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -24, opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="min-h-full"
      >
        <ActiveComponent />
      </motion.div>
    </AnimatePresence>
  );
}