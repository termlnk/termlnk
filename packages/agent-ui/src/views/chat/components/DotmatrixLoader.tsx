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

import { cn } from '@termlnk/design';
import { memo, useMemo } from 'react';

export type DotmatrixPattern = 'wave' | 'ripple';

interface IDotmatrixLoaderProps {
  size?: number;
  cellPx?: number;
  gapPx?: number;
  pattern?: DotmatrixPattern;
  className?: string;
}

const ANIMATION_DURATION_MS = 1400;

function getDelays(size: number, pattern: DotmatrixPattern): number[] {
  const delays: number[] = [];
  const center = (size - 1) / 2;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      switch (pattern) {
        case 'ripple': {
          const dist = Math.hypot(row - center, col - center);
          delays.push(Math.round((dist / Math.SQRT2 / size) * ANIMATION_DURATION_MS));
          break;
        }
        case 'wave':
        default: {
          const fraction = (row + col) / (2 * (size - 1) || 1);
          delays.push(Math.round(fraction * ANIMATION_DURATION_MS));
          break;
        }
      }
    }
  }
  return delays;
}

export const DotmatrixLoader = memo(function DotmatrixLoader({
  size = 5,
  cellPx = 4,
  gapPx = 2,
  pattern = 'wave',
  className,
}: IDotmatrixLoaderProps) {
  const delays = useMemo(() => getDelays(size, pattern), [size, pattern]);

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        `
          tm:tm-dotmatrix
          tm:inline-grid tm:align-middle
        `,
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${size}, ${cellPx}px)`,
        gap: `${gapPx}px`,
      }}
    >
      {delays.map((delay, i) => (
        <span
          key={i}
          className="
            tm:tm-dotmatrix-cell
            tm:inline-block tm:rounded-[1px]
          "
          style={{
            width: cellPx,
            height: cellPx,
            animationDelay: `${delay}ms`,
            animationDuration: `${ANIMATION_DURATION_MS}ms`,
          }}
        />
      ))}
    </span>
  );
});
