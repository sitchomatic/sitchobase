import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Global offline banner (#28). Shown at the top when the browser is offline.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-xs font-mono flex items-center justify-center gap-2 py-1.5 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      You're offline — polling paused. Reconnecting automatically.
    </div>
  );
}