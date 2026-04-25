import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Activity, FlaskConical, HeartPulse, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import FleetAlertBadge from '@/components/layout/FleetAlertBadge';
import { useAuth } from '@/lib/AuthContext';

const mobileNavItems = [
  { label: 'Dashboard', icon: LayoutGrid, path: '/' },
  { label: 'Sessions', icon: Activity, path: '/sessions' },
  { label: 'Bulk QA', icon: FlaskConical, path: '/bulk' },
  { label: 'Health', icon: HeartPulse, path: '/health' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  const boundedNavItems = mobileNavItems.filter((item) => item.path !== '/settings' || user);

  const handleTabPress = (path, active) => {
    if (active) {
      navigate(path, { replace: location.pathname !== path });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(path);
  };

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/85 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="px-2 pt-2 flex justify-center">
        <FleetAlertBadge />
      </div>
      <div className={cn(
        'grid px-2 pt-2',
        boundedNavItems.length === 5 ? 'grid-cols-5' :
        boundedNavItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
      )}>
        {boundedNavItems.map(({ label, icon: Icon, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <button
              key={path}
              onClick={() => handleTabPress(path, active)}
              className={cn(
                'flex min-h-[44px] w-full flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] transition-colors',
                active ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/80'
              )}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}