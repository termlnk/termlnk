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
    updater: {
      'dialog-title': '發現新版本',
      'new-version-available': '發現新版本可用',
      'update-ready': '更新已就緒',
      'release-notes': '更新內容',
      'download-update': '下載更新',
      downloading: '下載中...',
      'install-now': '立即安裝',
      retry: '重試',
    },
    header: {
      'pin-enable': '視窗置頂',
      'pin-disable': '取消置頂',
    },
  },
};

export default locale;
