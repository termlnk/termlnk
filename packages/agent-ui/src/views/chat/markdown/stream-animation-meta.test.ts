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

import { describe, expect, it } from 'vitest';
import { resolveBlockAnimationMeta } from './stream-animation-meta';

describe('resolveBlockAnimationMeta', () => {
  it('uses currentCharDelay for active (animating/streaming) blocks', () => {
    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 12,
        fadeDuration: 280,
        lastElapsedMs: 0,
        previousCharDelay: 30,
        state: 'streaming',
      })
    ).toEqual({ charDelay: 12, settled: false });

    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 8,
        fadeDuration: 280,
        lastElapsedMs: 0,
        previousCharDelay: 30,
        state: 'animating',
      })
    ).toEqual({ charDelay: 8, settled: false });
  });

  it('falls back to previousCharDelay for inactive blocks so frozen speed survives', () => {
    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 4,
        fadeDuration: 280,
        lastElapsedMs: 1000,
        previousCharDelay: 18,
        state: 'revealed',
      })
    ).toEqual({ charDelay: 18, settled: true });
  });

  it('falls back to currentCharDelay when no previousCharDelay is recorded', () => {
    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 18,
        fadeDuration: 280,
        lastElapsedMs: 0,
        previousCharDelay: undefined,
        state: 'queued',
      })
    ).toEqual({ charDelay: 18, settled: false });
  });

  it('marks revealed blocks as settled only after the fade window has elapsed', () => {
    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 18,
        fadeDuration: 280,
        lastElapsedMs: 100,
        previousCharDelay: 18,
        state: 'revealed',
      }).settled
    ).toBe(false);

    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 18,
        fadeDuration: 280,
        lastElapsedMs: 280,
        previousCharDelay: 18,
        state: 'revealed',
      }).settled
    ).toBe(true);

    expect(
      resolveBlockAnimationMeta({
        currentCharDelay: 18,
        fadeDuration: 280,
        lastElapsedMs: 280,
        previousCharDelay: 18,
        state: 'streaming',
      }).settled
    ).toBe(false);
  });
});
