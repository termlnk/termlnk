/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { CSSProperties, ReactNode, UIEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../common/cn';

export interface IVirtualListProps<T> {
  items: readonly T[];
  /** Fixed row height in px. Variable heights are out of scope for v1. */
  itemHeight: number;
  /**
   * Viewport height. Number = fixed px. String (e.g. '100%') fills the parent
   * and tracks size via ResizeObserver.
   */
  height: number | string;
  /** Extra rows rendered above/below the viewport. */
  overscan?: number;
  className?: string;
  style?: CSSProperties;
  getItemKey?: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

/**
 * Lightweight fixed-row virtual list. Prefer this over raw map() for large
 * trees/lists (file explorer, sftp, diffs). No DI — design-layer pure component.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  overscan = 6,
  className,
  style,
  getItemKey,
  renderItem,
  onScroll,
}: IVirtualListProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    if (typeof height === 'number') {
      setMeasuredHeight(height);
      return;
    }
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setMeasuredHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setMeasuredHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [height]);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    onScroll?.(e);
  }, [onScroll]);

  const viewportHeight = typeof height === 'number' ? height : measuredHeight;

  const { start, end, offsetY, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;
    const visible = Math.max(1, Math.ceil(Math.max(viewportHeight, 1) / itemHeight));
    const first = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const last = Math.min(items.length, first + visible + overscan * 2);
    return {
      start: first,
      end: last,
      offsetY: first * itemHeight,
      totalHeight: total,
    };
  }, [items.length, itemHeight, overscan, scrollTop, viewportHeight]);

  const slice = items.slice(start, end);

  return (
    <div
      ref={scrollerRef}
      className={cn('tm:overflow-x-hidden tm:overflow-y-auto', className)}
      style={{ height, ...style }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, i) => {
            const index = start + i;
            const key = getItemKey ? getItemKey(item, index) : index;
            return (
              <div key={key} style={{ height: itemHeight }}>
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
