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

/**
 * Pure math for grid projection — the inverse of FitAddon. The grid
 * (cols/rows) is fixed by a remote authority and must never change locally,
 * so instead of recomputing cols/rows from the container we recompute the
 * FONT SIZE at which the whole fixed grid fits the local container.
 */

export const MIN_PROJECTED_FONT_SIZE = 6;
export const MAX_PROJECTED_FONT_SIZE = 40;
export const PROJECTED_FONT_SIZE_STEP = 0.5;

export interface IProjectedFontSizeInput {
  availableWidth: number;
  availableHeight: number;
  /** Full grid width in px (cell width × cols) at `currentFontSize`. */
  gridWidth: number;
  /** Full grid height in px (cell height × rows) at `currentFontSize`. */
  gridHeight: number;
  currentFontSize: number;
}

/**
 * Proportional estimate of the largest font size at which the fixed grid
 * fits the available box. Floored to the step so the estimate errs toward
 * fitting; callers must still verify against re-measured cell metrics.
 */
export function estimateProjectedFontSize(input: IProjectedFontSizeInput): number {
  const { availableWidth, availableHeight, gridWidth, gridHeight, currentFontSize } = input;
  if (gridWidth <= 0 || gridHeight <= 0 || currentFontSize <= 0) {
    return currentFontSize;
  }
  const scale = Math.min(availableWidth / gridWidth, availableHeight / gridHeight);
  const quantized = Math.floor((currentFontSize * scale) / PROJECTED_FONT_SIZE_STEP) * PROJECTED_FONT_SIZE_STEP;
  return Math.min(MAX_PROJECTED_FONT_SIZE, Math.max(MIN_PROJECTED_FONT_SIZE, quantized));
}
