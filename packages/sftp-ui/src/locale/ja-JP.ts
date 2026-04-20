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
  'sftp-ui': {
    menu: { sftp: 'SFTP' },
    connection: {
      title: 'SFTP 接続',
      status: { connecting: '接続中...', authenticating: '認証中...', opening: 'SFTPを開いています...', ready: '接続済み', error: '接続失敗' },
      action: { close: '閉じる', retry: '再試行', continue: '続行' },
      password: { title: 'パスワードが必要です', placeholder: 'パスワードを入力' },
    },
    browser: { local: 'ローカル', remote: 'リモート', empty: '空のディレクトリ', loading: '読み込み中...', items: '{count}件', selected: '{count}件選択' },
    file: { name: '名前', size: 'サイズ', modified: '更新日時', permissions: '権限' },
    action: { download: 'ダウンロード', upload: 'アップロード', rename: '名前変更', delete: '削除', newFolder: '新しいフォルダ', permissions: '権限', refresh: '更新' },
    transfer: { title: '転送', clearCompleted: '完了した転送をクリア' },
    dialog: {
      rename: { title: '名前変更' },
      newFolder: { title: '新しいフォルダ', placeholder: 'フォルダ名' },
      permissions: { title: '権限', owner: '所有者', group: 'グループ', others: 'その他', read: '読み取り', write: '書き込み', execute: '実行', octal: '8進数' },
    },
  },
};

export default locale;
