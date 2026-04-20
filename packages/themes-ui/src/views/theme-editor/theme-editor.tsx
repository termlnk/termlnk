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
import { useState } from 'react';
import { AdvancedMode } from './advanced-mode';
import { SimpleMode } from './simple-mode';
import { ThemePreview } from './theme-preview';

export type EditorMode = 'simple' | 'advanced';

export interface IThemeEditorProps {
  /** 当前编辑的主题 */
  theme: ITheme;
  /** 主题变更回调 */
  onThemeChange?: (theme: ITheme) => void;
  /** 初始编辑模式 */
  initialMode?: EditorMode;
  /** 保存回调 */
  onSave?: (theme: ITheme) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 自定义类名 */
  className?: string;
}

export function ThemeEditor(props: IThemeEditorProps) {
  const {
    theme,
    onThemeChange,
    initialMode = 'simple',
    onSave,
    onReset,
    className = '',
  } = props;
  const [mode, setMode] = useState<EditorMode>(initialMode);

  return (
    <div
      className={`
        tm:flex tm:flex-col tm:gap-6
        ${className}
      `}
    >
      {/* 头部 */}
      <div className="tm:flex tm:items-center tm:justify-between">
        <div>
          <h3 className="tm:text-lg tm:font-medium tm:text-base05">
            {theme.name}
          </h3>
          <p className="tm:text-sm tm:text-grey-fg">
            {theme.type === 'dark' ? '深色主题' : '浅色主题'}
          </p>
        </div>

        {/* 模式切换 */}
        <div className="tm:flex tm:rounded-lg tm:bg-one-bg tm:p-1">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`
              tm:rounded-sm tm:px-3 tm:py-1.5 tm:text-sm tm:transition-colors
              ${mode === 'simple'
      ? 'tm:bg-blue tm:text-white'
      : `
        tm:text-grey-fg
        tm:hover:text-base05
      `
    }
            `}
          >
            简单模式
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`
              tm:rounded-sm tm:px-3 tm:py-1.5 tm:text-sm tm:transition-colors
              ${mode === 'advanced'
      ? 'tm:bg-blue tm:text-white'
      : `
        tm:text-grey-fg
        tm:hover:text-base05
      `
    }
            `}
          >
            高级模式
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="tm:flex tm:gap-6">
        {/* 左侧：颜色编辑器 */}
        <div className="tm:min-w-0 tm:flex-1">
          {mode === 'simple'
            ? (
              <SimpleMode
                theme={theme}
                onThemeChange={onThemeChange}
              />
            )
            : (
              <AdvancedMode
                theme={theme}
                onThemeChange={onThemeChange}
              />
            )}
        </div>

        {/* 右侧：预览 */}
        <div className="tm:w-80 tm:shrink-0">
          <div className="tm:sticky tm:top-4">
            <h4 className="tm:mb-3 tm:text-sm tm:font-medium tm:text-base05">
              预览
            </h4>
            <ThemePreview theme={theme} />
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      {(onSave || onReset) && (
        <div className="tm:flex tm:justify-end tm:gap-3 tm:border-t tm:border-line tm:pt-4">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className={`
                tm:rounded-lg tm:bg-one-bg tm:px-4 tm:py-2 tm:text-sm tm:text-grey-fg tm:transition-colors
                tm:hover:bg-one-bg2 tm:hover:text-base05
              `}
            >
              重置
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(theme)}
              className={`
                tm:rounded-lg tm:bg-blue tm:px-4 tm:py-2 tm:text-sm tm:text-white tm:transition-opacity
                tm:hover:opacity-90
              `}
            >
              保存主题
            </button>
          )}
        </div>
      )}
    </div>
  );
}
