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

import type { ITheme } from '@termlnk/themes';

export interface IThemePreviewProps {
  theme: ITheme;
}

export function ThemePreview({ theme }: IThemePreviewProps) {
  const { base_30, base_16 } = theme;

  return (
    <div
      className="tm:overflow-hidden tm:rounded-lg tm:border"
      style={{
        backgroundColor: base_30.black,
        borderColor: base_30.line,
      }}
    >
      {/* 标题栏 */}
      <div
        className="tm:flex tm:items-center tm:gap-2 tm:px-3 tm:py-2"
        style={{ backgroundColor: base_30.darker_black }}
      >
        <div className="tm:flex tm:gap-1.5">
          <div className="tm:size-3 tm:rounded-full" style={{ backgroundColor: base_30.red }} />
          <div className="tm:size-3 tm:rounded-full" style={{ backgroundColor: base_30.yellow }} />
          <div className="tm:size-3 tm:rounded-full" style={{ backgroundColor: base_30.green }} />
        </div>
        <span className="tm:flex-1 tm:text-center tm:text-xs" style={{ color: base_30.grey_fg }}>
          {theme.name}
        </span>
      </div>

      {/* 内容区 */}
      <div className="tm:space-y-3 tm:p-4">
        {/* 代码预览 */}
        <div
          className="tm:rounded-sm tm:p-3 tm:font-mono tm:text-sm"
          style={{ backgroundColor: base_30.one_bg }}
        >
          <div>
            <span style={{ color: base_16.base0E }}>const</span>
            {' '}
            <span style={{ color: base_16.base08 }}>theme</span>
            {' '}
            <span style={{ color: base_16.base05 }}>=</span>
            {' '}
            <span style={{ color: base_16.base0B }}>
              &quot;
              {theme.name}
              &quot;
            </span>
            <span style={{ color: base_16.base05 }}>;</span>
          </div>
          <div>
            <span style={{ color: base_16.base0D }}>console</span>
            <span style={{ color: base_16.base05 }}>.</span>
            <span style={{ color: base_16.base0D }}>log</span>
            <span style={{ color: base_16.base05 }}>(</span>
            <span style={{ color: base_16.base08 }}>theme</span>
            <span style={{ color: base_16.base05 }}>);</span>
          </div>
          <div style={{ color: base_16.base03 }}>
            {'// '}
            {theme.type === 'dark' ? 'Dark theme' : 'Light theme'}
          </div>
        </div>

        {/* UI 元素预览 */}
        <div className="tm:flex tm:flex-wrap tm:gap-2">
          <button
            className="tm:rounded-sm tm:px-3 tm:py-1.5 tm:text-sm"
            style={{
              backgroundColor: base_30.blue,
              color: base_30.black,
            }}
          >
            Primary
          </button>
          <button
            className="tm:rounded-sm tm:px-3 tm:py-1.5 tm:text-sm"
            style={{
              backgroundColor: base_30.one_bg2,
              color: base_30.white,
            }}
          >
            Secondary
          </button>
          <button
            className="tm:rounded-sm tm:px-3 tm:py-1.5 tm:text-sm"
            style={{
              backgroundColor: base_30.red,
              color: base_30.white,
            }}
          >
            Danger
          </button>
        </div>

        {/* 颜色色板 */}
        <div className="tm:flex tm:gap-1">
          {[
            base_30.red,
            base_30.orange,
            base_30.yellow,
            base_30.green,
            base_30.cyan,
            base_30.blue,
            base_30.purple,
            base_30.pink,
          ].map((color, i) => (
            <div
              key={i}
              className="
                tm:h-4 tm:flex-1
                tm:first:rounded-l
                tm:last:rounded-r
              "
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
