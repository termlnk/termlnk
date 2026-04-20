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

export type ThemeType = 'dark' | 'light';

export interface ITheme {
  name: string;
  displayName: string;
  type: ThemeType;
  base_30: IBase30Colors;
  base_16: Partial<IBase16Colors>;
}

export interface IBase30Colors {
  // 主背景
  white: string; // 主文本色
  black: string; // 主背景 (基准色)
  darker_black: string; // black - 6%
  black2: string; // black + 6%
  one_bg: string; // black + 10%
  one_bg2: string; // black + 16%
  one_bg3: string; // black + 22%
  // 前景色
  grey: string; // 次要文本 black + 40%
  grey_fg: string; // grey + 10%
  grey_fg2: string; // grey + 20%
  light_grey: string; // grey + 28%
  // 语义色
  red: string; // 红色
  baby_pink: string; // 浅粉色
  pink: string; // 粉色
  green: string; // 绿色
  vibrant_green: string; // 亮绿色
  blue: string; // 蓝色
  nord_blue: string; // 北欧蓝
  yellow: string; // 黄色
  sun: string; // 太阳色（暖黄）
  purple: string; // 紫色
  dark_purple: string; // 深紫色
  teal: string; // 青色
  orange: string; // 橙色
  cyan: string; // 青色（明亮）
  // UI 专用色
  line: string; // 分隔线颜色
  statusline_bg: string; // 状态栏背景色
  lightbg: string; // 浅背景色
  pmenu_bg: string; // 弹出菜单背景色
  folder_bg: string; // 文件夹图标颜色
}

export interface IBase16Colors {
  base00: string; // 默认背景色
  base01: string; // 浅背景色（状态栏、行号等）
  base02: string; // 选择背景色
  base03: string; // 注释、不可见字符
  base04: string; // 深前景色（状态栏）
  base05: string; // 默认前景色
  base06: string; // 浅前景色
  base07: string; // 最浅前景色
  base08: string; // 变量、标签
  base09: string; // 整数、布尔值、常量
  base0A: string; // 类名
  base0B: string; // 字符串
  base0C: string; // 正则表达式
  base0D: string; // 函数名
  base0E: string; // 关键字
  base0F: string; // 废弃代码标记
}

export interface ICustomTheme extends ITheme {
  isCustom: true;
  extendsFrom?: string;
}

export function isCustomTheme(theme: ITheme): theme is ICustomTheme {
  return 'isCustom' in theme && (theme as ICustomTheme).isCustom === true;
}
