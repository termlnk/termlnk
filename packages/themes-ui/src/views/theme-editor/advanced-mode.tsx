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

import type { IBase16Colors, IBase30Colors, ITheme } from '@termlnk/themes';
import { useCallback, useState } from 'react';
import { ColorPicker } from './color-picker';

export interface IAdvancedModeProps {
  theme: ITheme;
  onThemeChange?: (theme: ITheme) => void;
}

type TabType = 'ui' | 'syntax';

interface IColorGroup {
  title: string;
  colors: { key: string; label: string }[];
}

const uiColorGroups: IColorGroup[] = [
  {
    title: '中性色',
    colors: [
      { key: 'white', label: '白色' },
      { key: 'black', label: '黑色' },
      { key: 'darker_black', label: '更深黑' },
      { key: 'black2', label: '黑色2' },
      { key: 'one_bg', label: '背景1' },
      { key: 'one_bg2', label: '背景2' },
      { key: 'one_bg3', label: '背景3' },
      { key: 'grey', label: '灰色' },
      { key: 'grey_fg', label: '灰前景' },
      { key: 'grey_fg2', label: '灰前景2' },
      { key: 'light_grey', label: '浅灰' },
    ],
  },
  {
    title: '语义色',
    colors: [
      { key: 'red', label: '红色' },
      { key: 'baby_pink', label: '浅粉' },
      { key: 'pink', label: '粉色' },
      { key: 'green', label: '绿色' },
      { key: 'vibrant_green', label: '亮绿' },
      { key: 'blue', label: '蓝色' },
      { key: 'nord_blue', label: 'Nord蓝' },
      { key: 'seablue', label: '海蓝' },
      { key: 'yellow', label: '黄色' },
      { key: 'sun', label: '日光黄' },
      { key: 'purple', label: '紫色' },
      { key: 'dark_purple', label: '深紫' },
      { key: 'teal', label: '青色' },
      { key: 'orange', label: '橙色' },
      { key: 'cyan', label: '青蓝' },
    ],
  },
  {
    title: 'UI 专用',
    colors: [
      { key: 'line', label: '分隔线' },
      { key: 'statusline_bg', label: '状态栏背景' },
      { key: 'lightbg', label: '浅背景' },
      { key: 'pmenu_bg', label: '菜单背景' },
      { key: 'folder_bg', label: '文件夹背景' },
    ],
  },
];

const syntaxColors: { key: string; label: string; description: string }[] = [
  { key: 'base00', label: 'base00', description: '默认背景' },
  { key: 'base01', label: 'base01', description: '浅背景' },
  { key: 'base02', label: 'base02', description: '选择背景' },
  { key: 'base03', label: 'base03', description: '注释' },
  { key: 'base04', label: 'base04', description: '深前景' },
  { key: 'base05', label: 'base05', description: '默认前景' },
  { key: 'base06', label: 'base06', description: '浅前景' },
  { key: 'base07', label: 'base07', description: '最浅前景' },
  { key: 'base08', label: 'base08', description: '变量' },
  { key: 'base09', label: 'base09', description: '常量' },
  { key: 'base0A', label: 'base0A', description: '类名' },
  { key: 'base0B', label: 'base0B', description: '字符串' },
  { key: 'base0C', label: 'base0C', description: '正则' },
  { key: 'base0D', label: 'base0D', description: '函数' },
  { key: 'base0E', label: 'base0E', description: '关键字' },
  { key: 'base0F', label: 'base0F', description: '废弃' },
];

/**
 * 高级模式编辑器
 * 编辑所有 base_30 和 base_16 颜色
 */
export function AdvancedMode(props: IAdvancedModeProps) {
  const { theme, onThemeChange } = props;
  const [activeTab, setActiveTab] = useState<TabType>('ui');

  const handleBase30Change = useCallback((key: keyof IBase30Colors, value: string) => {
    if (!onThemeChange) return;

    onThemeChange({
      ...theme,
      base_30: {
        ...theme.base_30,
        [key]: value,
      },
    });
  }, [theme, onThemeChange]);

  const handleBase16Change = useCallback((key: keyof IBase16Colors, value: string) => {
    if (!onThemeChange) return;

    onThemeChange({
      ...theme,
      base_16: {
        ...theme.base_16,
        [key]: value,
      },
    });
  }, [theme, onThemeChange]);

  return (
    <div className="tm:space-y-4">
      {/* 标签切换 */}
      <div className="tm:flex tm:gap-2 tm:border-b tm:border-line">
        <button
          type="button"
          onClick={() => setActiveTab('ui')}
          className={`
            tm:-mb-px tm:border-b-2 tm:px-4 tm:py-2 tm:text-sm tm:transition-colors
            ${activeTab === 'ui'
      ? 'tm:border-blue tm:text-blue'
      : `
        tm:border-transparent tm:text-grey-fg
        tm:hover:text-base05
      `
    }
          `}
        >
          UI 颜色 (30)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('syntax')}
          className={`
            tm:-mb-px tm:border-b-2 tm:px-4 tm:py-2 tm:text-sm tm:transition-colors
            ${activeTab === 'syntax'
      ? 'tm:border-blue tm:text-blue'
      : `
        tm:border-transparent tm:text-grey-fg
        tm:hover:text-base05
      `
    }
          `}
        >
          语法颜色 (16)
        </button>
      </div>

      {/* UI 颜色编辑 */}
      {activeTab === 'ui' && (
        <div className="tm:space-y-6">
          {uiColorGroups.map((group) => (
            <div key={group.title}>
              <h4 className="tm:mb-3 tm:text-sm tm:font-medium tm:text-base05">
                {group.title}
              </h4>
              <div className="tm:grid tm:grid-cols-2 tm:gap-3">
                {group.colors.map(({ key, label }) => (
                  <div
                    key={key}
                    className="tm:rounded-sm tm:bg-one-bg tm:p-3"
                  >
                    <ColorPicker
                      label={label}
                      value={theme.base_30[key as keyof IBase30Colors]}
                      onChange={(value) => handleBase30Change(key as keyof IBase30Colors, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 语法颜色编辑 */}
      {activeTab === 'syntax' && (
        <div className="tm:grid tm:grid-cols-2 tm:gap-3">
          {syntaxColors.map(({ key, label, description }) => (
            <div
              key={key}
              className="tm:rounded-sm tm:bg-one-bg tm:p-3"
            >
              <ColorPicker
                label={`${label} - ${description}`}
                value={theme.base_16[key as keyof IBase16Colors] ?? ''}
                onChange={(value) => handleBase16Change(key as keyof IBase16Colors, value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
