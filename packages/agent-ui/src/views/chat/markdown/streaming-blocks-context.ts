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

import type { IBlockAnimationMeta } from './stream-animation-meta';
import type { IBlockInfo, IBlockState } from './use-stream-queue';
import { createContext, useContext } from 'react';

export interface IStreamingBlocksContextValue {
  blocks: IBlockInfo[];
  birthsByOffset: Map<number, number[]>;
  animationMetaByOffset: Map<number, IBlockAnimationMeta>;
  getBlockState: (index: number) => IBlockState;
  fadeDuration: number;
  renderNow: number;
}

export const StreamingBlocksContext
  = createContext<IStreamingBlocksContextValue | null>(null);

export function useStreamingBlocks(): IStreamingBlocksContextValue {
  const ctx = useContext(StreamingBlocksContext);
  if (!ctx) {
    throw new Error(
      'useStreamingBlocks must be used inside a <StreamingBlocksContext.Provider>'
    );
  }
  return ctx;
}
