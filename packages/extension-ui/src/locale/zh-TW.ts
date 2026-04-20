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
  'extension-ui': {
    menu: { extensions: '擴充功能' },
    action: {
      loadLocal: '載入本機擴充功能',
      refresh: '重新整理',
      enable: '啟用',
      disable: '停用',
      uninstall: '解除安裝',
      remove: '移除',
      reload: '重新載入',
      selectDirectory: '選擇擴充功能目錄',
      installFromNpm: '從 npm 安裝',
    },
    empty: '暫無已安裝的擴充功能',
    status: { activated: '已啟用', disabled: '已停用', error: '錯誤', installed: '已安裝' },
    tab: { installed: '已安裝', marketplace: '市集' },
    marketplace: {
      search: '搜尋市集...',
      install: '安裝',
      installed: '已安裝',
      installing: '安裝中',
      loadFailed: '載入市集失敗',
      empty: '暫無可用擴充功能',
      emptyHint: '點擊標題的下載按鈕可直接從 npm 安裝。',
      installs: '{0} 次安裝',
    },
    dialog: {
      installFromNpm: {
        title: '從 npm 安裝擴充功能',
        extensionId: '擴充功能 ID',
        packageName: 'NPM 套件名稱',
        version: '版本',
        submit: '安裝',
        cancel: '取消',
      },
    },
  },
};

export default locale;
