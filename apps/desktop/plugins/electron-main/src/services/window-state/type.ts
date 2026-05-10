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

import type { Rectangle } from 'electron';

export const MAIN_WINDOW_STATE_FIELD = 'mainWindowState';

export const DEFAULT_MAIN_WINDOW_WIDTH = 1080;
export const DEFAULT_MAIN_WINDOW_HEIGHT = 760;

export interface IMainWindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface IMainWindowState {
  bounds: IMainWindowBounds;
  isMaximized: boolean;
  isFullScreen: boolean;
}

const DEFAULT_MAIN_WINDOW_STATE: IMainWindowState = {
  bounds: {
    width: DEFAULT_MAIN_WINDOW_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
  },
  isMaximized: false,
  isFullScreen: false,
};

function normalizeBounds(value: Partial<Rectangle> | null | undefined): IMainWindowBounds {
  const fallbackWidth = DEFAULT_MAIN_WINDOW_WIDTH;
  const fallbackHeight = DEFAULT_MAIN_WINDOW_HEIGHT;

  if (!value || typeof value !== 'object') {
    return { width: fallbackWidth, height: fallbackHeight };
  }

  const width = Number.isFinite(value.width) && (value.width as number) > 0
    ? Math.round(value.width as number)
    : fallbackWidth;
  const height = Number.isFinite(value.height) && (value.height as number) > 0
    ? Math.round(value.height as number)
    : fallbackHeight;

  const bounds: IMainWindowBounds = { width, height };
  if (Number.isFinite(value.x)) {
    bounds.x = Math.round(value.x as number);
  }
  if (Number.isFinite(value.y)) {
    bounds.y = Math.round(value.y as number);
  }
  return bounds;
}

export function normalizeMainWindowState(value: Partial<IMainWindowState> | null | undefined): IMainWindowState {
  if (!value || typeof value !== 'object') {
    return {
      bounds: { ...DEFAULT_MAIN_WINDOW_STATE.bounds },
      isMaximized: false,
      isFullScreen: false,
    };
  }
  return {
    bounds: normalizeBounds(value.bounds as Partial<Rectangle> | null | undefined),
    isMaximized: typeof value.isMaximized === 'boolean' ? value.isMaximized : false,
    isFullScreen: typeof value.isFullScreen === 'boolean' ? value.isFullScreen : false,
  };
}
