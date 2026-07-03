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

import type { ITheme } from '../types';

/**
 * 从 ITheme 生成 CSS 变量字符串
 * Tailwind v4 使用 color-mix() 处理透明度，因此颜色值直接使用 hex 格式
 * 例如: --tm-blue: #61afef;
 *
 * @param theme - 主题对象
 * @param prefix - CSS 变量前缀，默认 '--tm'
 * @returns CSS 变量字符串
 */
export function generateCSSVariables(theme: ITheme, prefix = '--tm'): string {
  const lines: string[] = [];

  // base_30 颜色，key 中的下划线转为连字符
  for (const [key, value] of Object.entries(theme.base_30)) {
    const cssKey = key.replace(/_/g, '-');
    lines.push(`${prefix}-${cssKey}: ${value};`);
  }

  // base_16 颜色
  for (const [key, value] of Object.entries(theme.base_16)) {
    lines.push(`${prefix}-${key}: ${value};`);
  }

  return lines.join('\n');
}

/** 主题样式元素的 ID */
const THEME_STYLE_ID = 'tm-theme-variables';

export function injectThemeToDOM(theme: ITheme, prefix = '--tm'): void {
  if (typeof document === 'undefined') {
    return;
  }

  const css = generateCSSVariables(theme, prefix);

  let styleEl = document.getElementById(THEME_STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `:root {\n${css}\n}`;
}

export function removeThemeFromDOM(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const styleEl = document.getElementById(THEME_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}

/** 透明度覆盖样式元素的 ID */
const TRANSPARENCY_STYLE_ID = 'tm-transparency-override';

/** 需要添加 alpha 通道的背景色 key */
const BG_COLOR_KEYS = ['black', 'darker_black', 'black2', 'one_bg', 'one_bg2', 'one_bg3', 'statusline_bg', 'lightbg', 'pmenu_bg'];

/**
 * 向 DOM 注入透明度覆盖 CSS，将背景色变量替换为带 alpha 的版本。
 * 前景色（文字、边框等）不受影响，保持完全不透明。
 *
 * @param theme - 当前主题
 * @param opacity - 背景不透明度 (0.0 - 1.0)
 * @param prefix - CSS 变量前缀
 */
export function injectTransparencyToDOM(theme: ITheme, opacity: number, prefix = '--tm'): void {
  if (typeof document === 'undefined') {
    return;
  }

  // opacity >= 1 时移除覆盖
  if (opacity >= 1) {
    removeTransparencyFromDOM();
    return;
  }

  const percent = Math.round(opacity * 100);
  const lines: string[] = [];

  for (const key of BG_COLOR_KEYS) {
    const value = theme.base_30[key as keyof typeof theme.base_30];
    if (!value) {
      continue;
    }
    const cssKey = key.replace(/_/g, '-');
    lines.push(`${prefix}-${cssKey}: color-mix(in srgb, ${value} ${percent}%, transparent);`);
  }

  lines.push(`${prefix}-bg-opacity: ${opacity};`);

  const css = `:root {\n${lines.join('\n')}\n}\nhtml { background: transparent !important; }`;

  let styleEl = document.getElementById(TRANSPARENCY_STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = TRANSPARENCY_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
}

/**
 * 移除透明度覆盖 CSS，恢复原始主题颜色。
 */
export function removeTransparencyFromDOM(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const styleEl = document.getElementById(TRANSPARENCY_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}
