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
      'dialog-title': '新しいバージョン',
      'new-version-available': '新しいバージョンが利用可能です',
      'update-ready': '更新準備完了',
      'current-version': '現在のバージョン',
      'new-version': '新しいバージョン',
      'release-notes': 'リリースノート',
      'download-update': '更新をダウンロード',
      downloading: 'ダウンロード中...',
      'install-now': '今すぐインストール',
      retry: '再試行',
    },
  },
};

export default locale;
