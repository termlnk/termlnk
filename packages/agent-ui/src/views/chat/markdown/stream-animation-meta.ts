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

import type { IBlockState } from './use-stream-queue';

export interface IBlockAnimationMeta {
  charDelay: number;
  settled: boolean;
}

export interface IResolveBlockAnimationMetaOptions {
  currentCharDelay: number;
  fadeDuration: number;
  lastElapsedMs: number;
  previousCharDelay?: number;
  state: IBlockState;
}

function isActiveBlock(state: IBlockState): boolean {
  return state === 'animating' || state === 'streaming';
}

// Active blocks track live charDelay; inactive blocks freeze on their last
// active value so mid-fade speed changes never replay chars. A revealed
// block becomes `settled` only after its tail char's fade window expires.
export function resolveBlockAnimationMeta({
  currentCharDelay,
  fadeDuration,
  lastElapsedMs,
  previousCharDelay,
  state,
}: IResolveBlockAnimationMetaOptions): IBlockAnimationMeta {
  const charDelay = isActiveBlock(state)
    ? currentCharDelay
    : (previousCharDelay ?? currentCharDelay);
  const settled = state === 'revealed' && lastElapsedMs >= fadeDuration;

  return {
    charDelay,
    settled,
  };
}
