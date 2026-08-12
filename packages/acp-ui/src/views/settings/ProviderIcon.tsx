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
import { Bot } from 'lucide-react';

/**
 * Provider glyph. Brand marks are hand-written tsx (the project forbids
 * importing svg files), and anything without one falls back to its initial —
 * a generic square is what the reference UI shows for most of the long tail.
 */
export interface IProviderIconProps {
  iconId?: string;
  title: string;
  size?: number;
}

const BRAND_CLASSES: Record<string, string> = {
  'claude-code': 'tm:bg-orange/15 tm:text-orange',
  codex: 'tm:bg-one-bg3 tm:text-light-grey',
  gemini: 'tm:bg-blue/15 tm:text-blue',
  kimi: 'tm:bg-purple/15 tm:text-purple',
  cursor: 'tm:bg-one-bg3 tm:text-light-grey',
  cline: 'tm:bg-teal/15 tm:text-teal',
  goose: 'tm:bg-green/15 tm:text-green',
  grok: 'tm:bg-one-bg3 tm:text-light-grey',
  'qwen-code': 'tm:bg-purple/15 tm:text-purple',
  'mistral-vibe': 'tm:bg-yellow/15 tm:text-yellow',
  junie: 'tm:bg-pink/15 tm:text-pink',
  auggie: 'tm:bg-blue/15 tm:text-blue',
};

export function ProviderIcon({ iconId, title, size = 28 }: IProviderIconProps) {
  const key = iconId ?? '';
  const tone = BRAND_CLASSES[key] ?? 'tm:bg-one-bg2 tm:text-grey-fg2';
  const initial = title.trim()[0]?.toUpperCase();

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        'tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md tm:text-xs tm:font-semibold',
        tone
      )}
    >
      {initial ?? <Bot size={Math.round(size * 0.5)} strokeWidth={1.5} />}
    </span>
  );
}
