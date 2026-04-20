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
import { cn } from '@termlnk/design';
import { ThemeCard } from './theme-card';

export interface IThemePickerProps {
  /** 可选主题列表 */
  themes: ITheme[];
  /** 当前选中的主题 */
  currentTheme?: ITheme | null;
  /** 主题变更回调 */
  onThemeChange?: (theme: ITheme) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 主题选择器组件
 */
export function ThemePicker(props: IThemePickerProps) {
  const {
    themes,
    currentTheme,
    onThemeChange,
    className = '',
  } = props;

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4', className)}>
      {/* 主题网格 - 强制一行4个 */}
      <div className="tm:grid tm:grid-cols-4 tm:gap-3">
        {themes.map((theme) => (
          <ThemeCard
            key={theme.name}
            theme={theme}
            isSelected={currentTheme?.name === theme.name}
            onClick={() => onThemeChange?.(theme)}
          />
        ))}
      </div>

      {/* 空状态 */}
      {themes.length === 0 && (
        <div className="tm:py-8 tm:text-center tm:text-grey-fg">
          没有找到匹配的主题
        </div>
      )}
    </div>
  );
}
