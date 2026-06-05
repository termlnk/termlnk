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

import type { ReactNode } from 'react';
import { cn } from '@termlnk/design';
import { OVERVIEW_PADDING } from '@termlnk/island';

interface INotchLayerProps {
  active: boolean;
  children: ReactNode;
  className?: string;
  /** Top offset in px — pushes content below the macOS notch/camera area. */
  topOffset?: number;
  /** Enable vertical scrolling when content exceeds the layer height. */
  scrollable?: boolean;
}

export function NotchLayer({ active, children, className, topOffset, scrollable }: INotchLayerProps) {
  return (
    <div
      className={cn('tm:absolute tm:inset-0 tm:flex tm:items-center tm:justify-center', className)}
      style={{
        ...(topOffset ? { top: topOffset } : {}),
        opacity: active ? 1 : 0,
        filter: active ? 'blur(0)' : 'blur(6px)',
        transform: active ? 'scale(1)' : 'scale(0.96)',
        transition: 'opacity .25s, filter .3s, transform .35s cubic-bezier(0.175,0.885,0.32,1.1)',
        transitionDelay: active ? '0.06s' : '0s',
        pointerEvents: active ? 'auto' : 'none',
        overflowX: 'hidden',
        overflowY: scrollable && active ? 'auto' : 'hidden',
        borderRadius: 'inherit',
        padding: topOffset ? `0 14px ${OVERVIEW_PADDING}px` : '0 14px',
      }}
    >
      {children}
    </div>
  );
}
