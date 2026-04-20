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
    menu: { extensions: '拡張機能' },
    action: {
      loadLocal: 'ローカル拡張機能を読み込む',
      refresh: '更新',
      enable: '有効化',
      disable: '無効化',
      uninstall: 'アンインストール',
      remove: '削除',
      reload: '再読み込み',
      selectDirectory: '拡張機能ディレクトリを選択',
      installFromNpm: 'npm からインストール',
    },
    empty: 'インストールされた拡張機能はありません',
    status: { activated: 'アクティブ', disabled: '無効', error: 'エラー', installed: 'インストール済み' },
    tab: { installed: 'インストール済み', marketplace: 'マーケットプレイス' },
    marketplace: {
      search: 'マーケットプレイスを検索...',
      install: 'インストール',
      installed: 'インストール済み',
      installing: 'インストール中',
      loadFailed: 'マーケットプレイスの読み込みに失敗しました',
      empty: '利用可能な拡張機能はありません',
      emptyHint: 'ヘッダーのダウンロードボタンで npm から直接インストールできます。',
      installs: '{0} インストール',
    },
    dialog: {
      installFromNpm: {
        title: 'npm から拡張機能をインストール',
        extensionId: '拡張機能 ID',
        packageName: 'NPM パッケージ',
        version: 'バージョン',
        submit: 'インストール',
        cancel: 'キャンセル',
      },
    },
  },
};

export default locale;
