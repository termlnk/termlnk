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

import type enUS from './en-US';

const locale: typeof enUS = {
  'electron-renderer': {
    header: {
      'pin-enable': '窗口置顶',
      'pin-disable': '取消置顶',
    },
    'platform-tab': {
      label: '系统',
      description: '操作系统级集成：托盘、开机自启动、屏幕电源管理',
      'tray-enable': '启用系统托盘',
      'tray-enable-description': '在系统通知区域显示应用图标，提供快捷操作菜单',
      'close-to-tray': '最小化到托盘',
      'close-to-tray-description': '关闭窗口时隐藏到系统托盘，而不是退出应用',
      'startup-title': '启动',
      'auto-launch': '开机自动启动',
      'auto-launch-description': '系统登录时自动启动 Termlnk',
      'keep-awake-title': '保持屏幕常亮',
      'keep-awake-description': 'Agent 会话运行时防止屏幕关闭',
    },
  },
};

export default locale;
