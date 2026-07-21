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
import type { IIconPickerValue } from './IconPicker';
import { cn } from '@termlnk/design';

const DEFAULT_BADGE_SIZE = 16;
const EMOJI_FONT_SCALE = 0.68;

export interface IIconBadgeProps {
  icon?: IIconPickerValue;
  /** Rendered when no icon is set (e.g. the consumer's default glyph). */
  fallback?: ReactNode;
  size?: number;
}

/** Emoji badge on a colored rounded square; renders `fallback` when no icon is set. */
export function IconBadge({ icon, fallback = null, size = DEFAULT_BADGE_SIZE }: IIconBadgeProps) {
  if (!icon) {
    return fallback;
  }

  return (
    <div
      className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:rounded-[4px]')}
      style={{
        width: size,
        height: size,
        backgroundColor: icon.background,
        fontSize: Math.round(size * EMOJI_FONT_SCALE),
        lineHeight: 1,
      }}
    >
      {icon.emoji}
    </div>
  );
}
