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
 * xterm.js 终端主题接口
 * 用于配置终端的颜色方案
 */
export interface IXtermTheme {
  /** 前景色（默认文本） */
  foreground: string;
  /** 背景色 */
  background: string;
  /** 光标颜色 */
  cursor: string;
  /** 光标强调色 */
  cursorAccent: string;
  /** 选择背景色 */
  selectionBackground: string;
  /** 选择前景色 */
  selectionForeground: string;
  /** 概览标尺（overview ruler）边框色 */
  overviewRulerBorder?: string;
  /** 滚动条滑块背景色 */
  scrollbarSliderBackground?: string;
  /** 滚动条滑块悬停背景色 */
  scrollbarSliderHoverBackground?: string;
  /** 滚动条滑块激活背景色 */
  scrollbarSliderActiveBackground?: string;

  // ANSI 标准 16 色
  /** 黑色 */
  black: string;
  /** 红色 */
  red: string;
  /** 绿色 */
  green: string;
  /** 黄色 */
  yellow: string;
  /** 蓝色 */
  blue: string;
  /** 品红色 */
  magenta: string;
  /** 青色 */
  cyan: string;
  /** 白色 */
  white: string;
  /** 亮黑色 */
  brightBlack: string;
  /** 亮红色 */
  brightRed: string;
  /** 亮绿色 */
  brightGreen: string;
  /** 亮黄色 */
  brightYellow: string;
  /** 亮蓝色 */
  brightBlue: string;
  /** 亮品红色 */
  brightMagenta: string;
  /** 亮青色 */
  brightCyan: string;
  /** 亮白色 */
  brightWhite: string;
}
