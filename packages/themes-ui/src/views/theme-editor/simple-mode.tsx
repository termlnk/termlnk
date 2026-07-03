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

import type { IBase30Colors, ITheme } from '@termlnk/themes';
import { useCallback } from 'react';
import { ColorPicker } from './color-picker';

export interface SimpleModeProps {
  /** Current theme */
  theme: ITheme;
  /** Theme change callback */
  onThemeChange?: (theme: ITheme) => void;
}

/**
 * Simple mode editor — edit 4 key colors: background, foreground, accent, border.
 */
export function SimpleMode({ theme, onThemeChange }: SimpleModeProps) {
  const handleColorChange = useCallback((key: keyof IBase30Colors, value: string) => {
    if (!onThemeChange) {
      return;
    }

    onThemeChange({
      ...theme,
      base_30: {
        ...theme.base_30,
        [key]: value,
      },
    });
  }, [theme, onThemeChange]);

  const simpleColors = [
    { key: 'black' as const, label: '背景色', description: '主要背景颜色' },
    { key: 'white' as const, label: '前景色', description: '主要文字颜色' },
    { key: 'blue' as const, label: '强调色', description: '按钮、链接等强调元素' },
    { key: 'line' as const, label: '边框色', description: '分隔线、边框颜色' },
  ];

  return (
    <div className="tm:space-y-6">
      <div className="tm:mb-4 tm:text-sm tm:text-grey-fg">
        调整 4 个关键颜色，快速自定义主题外观
      </div>

      <div className="tm:space-y-4">
        {simpleColors.map(({ key, label, description }) => (
          <div
            key={key}
            className="tm:rounded-lg tm:bg-one-bg tm:p-4"
          >
            <div className="tm:flex tm:items-start tm:gap-4">
              <div className="tm:flex-1">
                <div className="tm:mb-1 tm:text-sm tm:font-medium tm:text-base05">
                  {label}
                </div>
                <div className="tm:text-xs tm:text-grey-fg">
                  {description}
                </div>
              </div>
              <ColorPicker
                value={theme.base_30[key]}
                onChange={(value) => handleColorChange(key, value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
