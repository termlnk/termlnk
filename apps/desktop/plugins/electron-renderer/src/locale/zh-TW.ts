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
      'pin-enable': '視窗置頂',
      'pin-disable': '取消置頂',
    },
    'platform-tab': {
      label: '系統',
      description: '作業系統級整合：系統匣、登入時啟動、螢幕電源管理',
      'tray-enable': '啟用系統匣',
      'tray-enable-description': '在系統通知區域顯示應用程式圖示，提供快速操作選單',
      'close-to-tray': '最小化至系統匣',
      'close-to-tray-description': '關閉視窗時隱藏到系統匣，而非結束應用程式',
      'startup-title': '啟動',
      'auto-launch': '登入時自動啟動',
      'auto-launch-description': '系統登入時自動啟動 Termlnk',
      'keep-awake-title': '保持螢幕常亮',
      'keep-awake-description': 'Agent 會話執行時防止螢幕關閉',
    },
  },
};

export default locale;
