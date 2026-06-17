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

/**
 * Pixel pet glyph (6×5). Rows (empty slots shape the silhouette):
 *   █ ▢ ▢ ▢ ▢ █   ears (isolated so eye sockets stay fully enclosed)
 *   █ █ █ █ █ █   crown
 *   █ ▢ █ █ ▢ █   eyes (framed top/bottom → read as round holes)
 *   █ █ █ █ █ █   cheeks
 *   ▢ █ █ █ █ ▢   chin
 */
const PET_PIXELS = [
  { x: 1, y: 1 },
  { x: 6, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
  { x: 6, y: 2 },
  { x: 1, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 6, y: 3 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  { x: 6, y: 4 },
  { x: 2, y: 5 },
  { x: 3, y: 5 },
  { x: 4, y: 5 },
  { x: 5, y: 5 },
] as const;

interface IBrandGlyphProps {
  accentColor: string;
  animated: boolean;
  /**
   * Render a small `?` glyph above the pet's head. Signals that an
   * AskUserQuestion is pending and the user should answer in the
   * originating terminal's TUI. The island itself is not interactive
   * for question-kind pendings.
   */
  questioning?: boolean;
}

export function BrandGlyph({ accentColor, animated, questioning }: IBrandGlyphProps) {
  return (
    <div
      className={cn(
        'tm:relative tm:grid tm:h-3.75 tm:w-4.5 tm:grid-cols-6 tm:grid-rows-5',
        {
          'island-brand-active': animated,
        }
      )}
      aria-hidden="true"
    >
      {PET_PIXELS.map((pixel) => (
        <span
          key={`${pixel.x}-${pixel.y}`}
          className={cn('tm:size-0.75 tm:rounded-[1px]')}
          style={{
            gridColumnStart: pixel.x,
            gridRowStart: pixel.y,
            backgroundColor: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
          }}
        />
      ))}
      {questioning && (
        <span
          className={cn('tm:pointer-events-none tm:absolute tm:font-mono')}
          style={{
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            color: accentColor,
            textShadow: `0 0 6px ${accentColor}`,
            animation: 'vi-pulse 1.4s ease-in-out infinite',
          }}
        >
          ?
        </span>
      )}
    </div>
  );
}
