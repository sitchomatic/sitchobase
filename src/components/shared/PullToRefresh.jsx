import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PullToRefresh({ onRefresh, children }) {
  const isMobile = useIsMobile();
  const startY = useRef(0);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = (e) => {
    if (!isMobile || window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const handleTouchMove = (e) => {
    if (!pulling.current || refreshing) return;
    const distance = Math.max(0, e.touches[0].clientY - startY.current);
    setOffset(Math.min(distance * 0.45, 72));
  };

  const handleTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (offset >= 56) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setOffset(0);
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ height: offset > 0 || refreshing ? 56 : 0 }}
      >
        <div className="h-14 flex items-center justify-center text-gray-500 text-xs gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      </div>
      {children}
    </div>
  );
}