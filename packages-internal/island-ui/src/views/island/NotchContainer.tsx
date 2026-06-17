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

import type { ISceneSize } from '@termlnk/island';
import type { ReactNode } from 'react';
import { cn } from '@termlnk/design';
import { useCallback } from 'react';
import { setIslandInteractive } from '../hooks/island-ipc';

interface INotchContainerProps {
  size: ISceneSize;
  shadow: string;
  children: ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** When true, widen the side ear curves for a smoother transition into the expanded notch. */
  expanded?: boolean;
}

const EAR_EASE = 'cubic-bezier(0.175,0.885,0.32,1)';

export function NotchContainer({
  size,
  shadow,
  children,
  onMouseEnter,
  onMouseLeave,
  expanded = false,
}: INotchContainerProps) {
  // Geometric constraint: for the quarter-arc transition to land inside the
  // main island body, `shadowOffset` must equal `earRadius` — that positions
  // the radius' center on the island's edge (x=0). Otherwise the arc gets
  // clipped to a nearly-flat sliver and looks like a right angle.
  const earRadius = expanded ? 18 : 6;
  const shadowOffset = expanded ? 18 : 5;
  const earWidth = expanded ? 36 : 13;
  const earHeight = expanded ? 38 : 25;
  const earTransition = `width 0.5s ${EAR_EASE}, height 0.5s ${EAR_EASE}, left 0.5s ${EAR_EASE}, right 0.5s ${EAR_EASE}, border-top-right-radius 0.5s ${EAR_EASE}, border-top-left-radius 0.5s ${EAR_EASE}, box-shadow 0.5s ${EAR_EASE}`;
  const handleMouseEnter = useCallback(() => {
    setIslandInteractive(true);
    onMouseEnter();
  }, [onMouseEnter]);

  const handleMouseLeave = useCallback(() => {
    setIslandInteractive(false);
    onMouseLeave();
  }, [onMouseLeave]);

  return (
    <div className={cn('tm:flex tm:w-full tm:justify-center')}>
      <div
        className={cn('tm:relative')}
        style={{
          background: '#000000',
          width: size.w,
          height: size.h,
          borderRadius: `0 0 ${size.r}px ${size.r}px`,
          boxShadow: shadow,
          transition: 'width 0.5s cubic-bezier(0.175,0.885,0.32,1), height 0.5s cubic-bezier(0.175,0.885,0.32,1), box-shadow 0.5s ease',
          overflow: 'visible',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Left ear */}
        <div
          className={cn('tm:pointer-events-none tm:absolute tm:top-0')}
          style={{
            left: -earWidth,
            width: earWidth,
            height: earHeight,
            borderTopRightRadius: earRadius,
            boxShadow: `#000 ${shadowOffset}px 0`,
            transition: earTransition,
          }}
        />
        {/* Right ear */}
        <div
          className={cn('tm:pointer-events-none tm:absolute tm:top-0')}
          style={{
            right: -earWidth,
            width: earWidth,
            height: earHeight,
            borderTopLeftRadius: earRadius,
            boxShadow: `#000 ${-shadowOffset}px 0`,
            transition: earTransition,
          }}
        />

        {children}
      </div>
    </div>
  );
}
