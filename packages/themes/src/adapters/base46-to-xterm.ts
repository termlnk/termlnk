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

import type { ITheme, IXtermTheme } from '../types';

export function base46ToXterm(theme: ITheme, backgroundOpacity?: number): IXtermTheme {
  const { base_30, base_16 } = theme;

  // Default fallback colors
  const defaultBg = base_30.black;
  const defaultFg = base_30.white;
  const defaultSelectionBg = base_30.one_bg;
  const defaultComment = base_30.grey;
  const defaultLightFg = base_30.grey_fg;

  const rawBg = base_16.base00 ?? defaultBg;
  // When transparency is enabled, use fully transparent background so the
  // container's CSS color-mix handles it — avoids double-opacity stacking.
  const bg = backgroundOpacity !== undefined && backgroundOpacity < 1
    ? '#00000000'
    : rawBg;

  return {
    background: bg,
    foreground: base_16.base05 ?? defaultFg,
    cursor: base_16.base05 ?? defaultFg,
    cursorAccent: base_16.base00 ?? defaultBg,
    selectionBackground: base_16.base02 ?? defaultSelectionBg,
    selectionForeground: base_16.base05 ?? defaultFg,
    overviewRulerBorder: '#00000000',
    scrollbarSliderBackground: base_30.grey,
    scrollbarSliderHoverBackground: base_30.grey_fg,
    scrollbarSliderActiveBackground: base_30.light_grey,
    black: base_16.base00 ?? defaultBg,
    red: base_30.red,
    green: base_30.green,
    yellow: base_30.yellow,
    blue: base_30.blue,
    magenta: base_30.purple,
    cyan: base_30.cyan,
    white: base_16.base05 ?? defaultFg,
    brightBlack: base_16.base03 ?? defaultComment,
    brightRed: base_30.baby_pink,
    brightGreen: base_30.vibrant_green,
    brightYellow: base_30.sun,
    brightBlue: base_30.nord_blue,
    brightMagenta: base_30.pink,
    brightCyan: base_30.teal,
    brightWhite: base_16.base07 ?? defaultLightFg,
  };
}
