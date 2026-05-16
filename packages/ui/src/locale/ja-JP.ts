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
        all: 'すべて',
        unread: '未読',
      },
      actions: {
        'mark-all-read': 'すべて既読',
        'mark-all-read-title': 'すべて既読にする',
        'clear-all-title': 'すべて削除',
        'mark-read-title': '既読にする',
        'remove-title': '削除',
      },
      empty: '通知はありません',
      source: {
        prefix: '送信元: {0}',
        terminal: 'ターミナル',
        system: 'システム',
        extension: '拡張機能',
        application: 'アプリケーション',
        agent: 'Agent',
      },
      time: {
        'just-now': 'たった今',
        'minutes-ago': '{0}分前',
        'hours-ago': '{0}時間前',
        'days-ago': '{0}日前',
      },
      footer: {
        total: '{0}件の通知',
        unread: '{0}件未読',
        'total-with-unread': '{0}件の通知、{1}件未読',
      },
    },
    'notification-icon': {
      title: '通知',
      'unread-title': '{0}件の未読通知',
    },
    'right-sidebar-toggle': {
      'open-title': '右サイドバーを開く',
      'close-title': '右サイドバーを閉じる',
    },
    'left-sidebar-toggle': {
      'open-title': '左サイドバーを表示',
      'close-title': '左サイドバーを非表示',
    },
    updater: {
      'dialog-title': '新しいバージョンが利用可能',
      'new-version-available': '新しいバージョンが利用可能です',
      'update-ready': '更新の準備完了',
      'release-notes': 'リリースノート',
      'download-update': '更新をダウンロード',
      downloading: 'ダウンロード中...',
      'install-now': '今すぐインストール',
      retry: '再試行',
      'manual-update-hint': '新しいバージョンが利用可能です。最新の docker イメージを pull するか、git pull を実行して更新してください——ブラウザデプロイではアプリ内インストールはサポートされません。',
    },
  },
};

export default locale;
