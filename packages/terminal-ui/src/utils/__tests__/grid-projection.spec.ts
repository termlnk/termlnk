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
import { estimateProjectedFontSize } from '../grid-projection';

describe('estimateProjectedFontSize', () => {
  it('scales the font size down when the grid overflows the container', () => {
    // Grid twice as large as the container in both axes → ~half the size.
    const result = estimateProjectedFontSize({
      availableWidth: 400,
      availableHeight: 300,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 14,
    });
    expect(result).toBe(7);
  });

  it('uses the tighter axis as the limiting factor', () => {
    // Width fits exactly, height is half → height limits the scale.
    const result = estimateProjectedFontSize({
      availableWidth: 800,
      availableHeight: 300,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 14,
    });
    expect(result).toBe(7);
  });

  it('scales the font size up when the container is larger than the grid', () => {
    const result = estimateProjectedFontSize({
      availableWidth: 1600,
      availableHeight: 1200,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 12,
    });
    expect(result).toBe(24);
  });

  it('floors to the half-pixel step so the estimate errs toward fitting', () => {
    // scale = 0.9 → 14 * 0.9 = 12.6 → floored to 12.5, never rounded up.
    const result = estimateProjectedFontSize({
      availableWidth: 720,
      availableHeight: 10_000,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 14,
    });
    expect(result).toBe(12.5);
  });

  it('returns the current size unchanged when the grid already fits exactly', () => {
    const result = estimateProjectedFontSize({
      availableWidth: 800,
      availableHeight: 600,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 14,
    });
    expect(result).toBe(14);
  });

  it('clamps to the minimum font size for extreme viewer/owner mismatches', () => {
    const result = estimateProjectedFontSize({
      availableWidth: 100,
      availableHeight: 80,
      gridWidth: 2000,
      gridHeight: 1500,
      currentFontSize: 14,
    });
    expect(result).toBe(6);
  });

  it('clamps to the maximum font size when the container dwarfs the grid', () => {
    const result = estimateProjectedFontSize({
      availableWidth: 10_000,
      availableHeight: 8000,
      gridWidth: 400,
      gridHeight: 300,
      currentFontSize: 14,
    });
    expect(result).toBe(40);
  });

  it('returns the current size for degenerate grid measurements', () => {
    expect(estimateProjectedFontSize({
      availableWidth: 800,
      availableHeight: 600,
      gridWidth: 0,
      gridHeight: 600,
      currentFontSize: 14,
    })).toBe(14);
    expect(estimateProjectedFontSize({
      availableWidth: 800,
      availableHeight: 600,
      gridWidth: 800,
      gridHeight: 0,
      currentFontSize: 14,
    })).toBe(14);
    expect(estimateProjectedFontSize({
      availableWidth: 800,
      availableHeight: 600,
      gridWidth: 800,
      gridHeight: 600,
      currentFontSize: 0,
    })).toBe(0);
  });
});
