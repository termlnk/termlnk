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
  ui: {
    'notification-panel': {
      title: '通知',
      filter: {
        all: '全部',
        unread: '未讀',
      },
      actions: {
        'mark-all-read': '全部已讀',
        'mark-all-read-title': '全部標記為已讀',
        'clear-all-title': '清空所有',
        'mark-read-title': '標記為已讀',
        'remove-title': '刪除',
      },
      empty: '暫無通知',
      source: {
        prefix: '來自: {0}',
        terminal: '終端機',
        system: '系統',
        extension: '擴充功能',
        application: '應用程式',
        agent: 'Agent',
      },
      time: {
        'just-now': '剛剛',
        'minutes-ago': '{0}分鐘前',
        'hours-ago': '{0}小時前',
        'days-ago': '{0}天前',
      },
      footer: {
        total: '共 {0} 則通知',
        unread: '{0} 則未讀',
        'total-with-unread': '共 {0} 則通知，{1} 則未讀',
      },
    },
    'notification-icon': {
      title: '通知',
      'unread-title': '{0} 則未讀通知',
    },
    'right-sidebar-toggle': {
      'open-title': '開啟右側邊欄',
      'close-title': '關閉右側邊欄',
    },
    'left-sidebar-toggle': {
      'open-title': '顯示左側邊欄',
      'close-title': '隱藏左側邊欄',
    },
    updater: {
      'dialog-title': '發現新版本',
      'new-version-available': '發現新版本可用',
      'update-ready': '更新已就緒',
      'release-notes': '更新內容',
      'download-update': '下載更新',
      downloading: '下載中...',
      'install-now': '立即安裝',
      retry: '重試',
      'manual-update-hint': '發現新版本。請拉取最新 docker 鏡像或執行 git pull 進行更新——瀏覽器部署不支援應用內安裝。',
    },
  },
};

export default locale;
