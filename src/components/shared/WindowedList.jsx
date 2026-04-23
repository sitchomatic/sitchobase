/**
 * Tiny fixed-row-height windowed list (#39). No external deps.
 * Only renders rows inside the visible viewport + a buffer.
 *
 * Props:
 *   items, rowHeight, renderRow(item, index), overscan = 6, className
 */
import { useState, useRef, useEffect, useMemo } from 'react';

export default function WindowedList({ items, rowHeight = 56, renderRow, overscan = 6, className = '' }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewport(el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  const { startIdx, endIdx, padTop, padBottom } = useMemo(() => {
    const total = items.length;
    const visCount = Math.ceil(viewport / rowHeight);
    const s = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const e = Math.min(total, s + visCount + overscan * 2);
    return {
      startIdx: s,
      endIdx: e,
      padTop: s * rowHeight,
      padBottom: (total - e) * rowHeight,
    };
  }, [items.length, scrollTop, viewport, rowHeight, overscan]);

  // Under 100 rows, skip virtualization entirely — simpler DOM.
  if (items.length < 100) {
    return (
      <div ref={containerRef} className={className}>
        {items.map((item, i) => renderRow(item, i))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div style={{ height: padTop }} />
      {items.slice(startIdx, endIdx).map((item, i) => renderRow(item, startIdx + i))}
      <div style={{ height: padBottom }} />
    </div>
  );
}