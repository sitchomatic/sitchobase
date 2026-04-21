import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'bb_fleet_alerts';

function readAlerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function FleetAlertBadge() {
  const [count, setCount] = useState(readAlerts().length);

  useEffect(() => {
    const sync = () => setCount(readAlerts().length);
    sync();
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 3000);
    return () => {
      window.removeEventListener('storage', sync);
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
      <AlertTriangle className="w-3 h-3 text-red-400" />
      {count} alerts
    </div>
  );
}