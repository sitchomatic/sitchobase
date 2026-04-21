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
  '/monitor': Monitor,
  '/audit': AuditLog,
};

export default function AppShellRoutes({ pathname }) {
  const ActiveComponent = routeMap[pathname] || PageNotFound;

  return (
    <>
      {Object.entries(routeMap).map(([path, Component]) => {
        const isActive = path === pathname;
        return (
          <div key={path} className={isActive ? 'block min-h-full' : 'hidden min-h-full'}>
            <Component />
          </div>
        );
      })}
      {!routeMap[pathname] && <PageNotFound />}
    </>
  );
}