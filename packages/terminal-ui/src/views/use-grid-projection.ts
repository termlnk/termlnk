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

import type { Terminal } from '@xterm/xterm';
import type { CSSProperties, RefObject } from 'react';
import { fromFontFaceSetEvent } from '@termlnk/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { estimateProjectedFontSize, MIN_PROJECTED_FONT_SIZE, PROJECTED_FONT_SIZE_STEP } from '../utils/grid-projection';
import { invalidateXtermFontMetrics } from './hooks';

/**
 * Grid projection is the inverse of FitAddon: the grid (cols/rows) is fixed
 * by a remote authority (e.g. the owner PTY of a shared session) and must
 * never change locally, so instead of recomputing cols/rows from the
 * container we recompute the FONT SIZE so the whole fixed grid fits the
 * local container — scaled down when the local window is smaller than the
 * remote one, scaled up (bounded) when it is larger.
 */

// Cell metrics are a rounded, non-linear function of font size, so one
// proportional estimate can land a step off — re-measure and re-estimate.
const ESTIMATE_ITERATIONS = 4;
// Absolute upper bound on the final shrink-until-fits loop.
const SHRINK_GUARD_ITERATIONS = 24;
const REFIT_DEBOUNCE_MS = 100;
const FALLBACK_SCROLLBAR_WIDTH = 14;

export interface IUseXtermGridProjectionOptions {
  enabled?: boolean;
  xtermRef: RefObject<Terminal | null>;
  /** Outer box the grid is projected into; observed for size changes. */
  containerRef: RefObject<HTMLElement | null>;
  /** Appearance inputs — re-project when the user changes any of them. */
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
}

export interface IUseXtermGridProjectionResult {
  /**
   * Exact pixel size of the xterm mount element for the current projection,
   * or undefined before the first successful projection (callers should
   * fall back to filling the container). Centering the mount element inside
   * the container yields the letterbox.
   */
  gridStyle: CSSProperties | undefined;
  /** Re-run the projection; call after `term.resize()` from remote events. */
  refit: () => void;
}

export function useXtermGridProjection(options: IUseXtermGridProjectionOptions): IUseXtermGridProjectionResult {
  const { enabled = true, xtermRef, containerRef } = options;
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const refit = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    const term = xtermRef.current;
    const container = containerRef.current;
    if (!term || !container || !term.element) {
      return;
    }

    const scrollbarWidth = getScrollbarWidth(term);
    const padding = getXtermPadding(term.element);
    const availableWidth = container.clientWidth - scrollbarWidth - padding.horizontal;
    const availableHeight = container.clientHeight - padding.vertical;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    for (let i = 0; i < ESTIMATE_ITERATIONS; i++) {
      const cell = term.dimensions?.css.cell;
      if (!cell || cell.width <= 0 || cell.height <= 0) {
        return;
      }
      const current = getFontSize(term);
      const next = estimateProjectedFontSize({
        availableWidth,
        availableHeight,
        gridWidth: cell.width * term.cols,
        gridHeight: cell.height * term.rows,
        currentFontSize: current,
      });
      if (next === current) {
        break;
      }
      term.options.fontSize = next;
    }

    // Hard guarantee: never leave the grid overflowing the container unless
    // already at the minimum font size (extreme viewer/owner size mismatch).
    for (let i = 0; i < SHRINK_GUARD_ITERATIONS; i++) {
      const cell = term.dimensions?.css.cell;
      if (!cell || cell.width <= 0 || cell.height <= 0) {
        break;
      }
      const fits = cell.width * term.cols <= availableWidth
        && cell.height * term.rows <= availableHeight;
      const current = getFontSize(term);
      if (fits || current <= MIN_PROJECTED_FONT_SIZE) {
        break;
      }
      term.options.fontSize = current - PROJECTED_FONT_SIZE_STEP;
    }

    const cell = term.dimensions?.css.cell;
    if (!cell || cell.width <= 0 || cell.height <= 0) {
      return;
    }
    const width = Math.ceil(cell.width * term.cols) + scrollbarWidth + padding.horizontal;
    const height = Math.ceil(cell.height * term.rows) + padding.vertical;
    setGridSize((prev) => {
      return prev && prev.width === width && prev.height === height ? prev : { width, height };
    });
  }, [xtermRef, containerRef]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let resizeTimeout: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) {
        return;
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(refit, REFIT_DEBOUNCE_MS);
    });

    observer.observe(container);
    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      observer.disconnect();
    };
  }, [enabled, containerRef, refit]);

  // Re-project after web fonts load — the initial projection uses
  // fallback-font cell metrics. Same caveat as useXterm's auto-fit path:
  // xterm's CharSizeService cache must be invalidated first.
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const disposable = fromFontFaceSetEvent('loadingdone', () => {
      const term = xtermRef.current;
      if (term) {
        try {
          invalidateXtermFontMetrics(term);
        } catch { }
      }
      refit();
    });
    return () => disposable.dispose();
  }, [enabled, xtermRef, refit]);

  // Re-project when appearance inputs change. This hook must be called
  // AFTER useXterm in the component so useXterm's appearance effect (which
  // restores the user-configured font size) runs first and the projection
  // wins. Deferred a frame so the projection never sets state synchronously
  // inside the effect.
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const frameId = requestAnimationFrame(refit);
    return () => cancelAnimationFrame(frameId);
  }, [enabled, options.fontFamily, options.fontSize, options.letterSpacing, refit]);

  const gridStyle = useMemo<CSSProperties | undefined>(() => {
    return gridSize ? { width: gridSize.width, height: gridSize.height } : undefined;
  }, [gridSize]);

  return { gridStyle, refit };
}

function getFontSize(term: Terminal): number {
  const size = term.options.fontSize;
  return typeof size === 'number' && size > 0 ? size : MIN_PROJECTED_FONT_SIZE;
}

// Mirrors FitAddon's scrollbar accounting so the projected mount element is
// wide enough for the grid plus the overlay scrollbar gutter.
function getScrollbarWidth(term: Terminal): number {
  const showScrollbar = term.options.scrollbar?.showScrollbar ?? true;
  if (term.options.scrollback === 0 || !showScrollbar) {
    return 0;
  }
  return term.options.scrollbar?.width ?? FALLBACK_SCROLLBAR_WIDTH;
}

// The `.xterm` element carries CSS padding (see global.css); like FitAddon,
// subtract it from the available box and add it back to the mount size.
function getXtermPadding(element: HTMLElement): { horizontal: number; vertical: number } {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) {
    return { horizontal: 0, vertical: 0 };
  }
  const top = Number.parseInt(style.getPropertyValue('padding-top'), 10) || 0;
  const bottom = Number.parseInt(style.getPropertyValue('padding-bottom'), 10) || 0;
  const left = Number.parseInt(style.getPropertyValue('padding-left'), 10) || 0;
  const right = Number.parseInt(style.getPropertyValue('padding-right'), 10) || 0;
  return { horizontal: left + right, vertical: top + bottom };
}
