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

export default {
  'sync-ui': {
    status: {
      title: 'クラウド同期',
      'toggle-label': '同期',
      'sync-now': '今すぐ同期',
      'force-resync': '最初から再同期',
      'force-resync-hint': 'カーソルをリセットして全件を再取得します。ローカルデータが古い／破損している疑いがある場合に使用します。',
      'never-synced': '未同期',
      'just-now': 'たった今同期しました',
      'minutes-ago': '{0} 分前に同期',
      'hours-ago': '{0} 時間前に同期',
      'days-ago': '{0} 日前に同期',
      pending: '未送信の変更が {0} 件',
    },
    state: {
      idle: '最新',
      syncing: '同期中',
      offline: 'オフライン',
      error: 'エラー',
      disabled: '無効',
    },
    error: {
      unauthenticated: '同期するにはサインインが必要です',
      master_key_locked: 'マスターキーがロックされています',
      network: 'ネットワークエラー',
      rate_limited: 'サーバーによりレート制限されました',
      protocol_mismatch: 'クライアント／サーバーのスキーマが一致しません',
      cipher_mismatch: '復号に失敗しました',
      server_error: 'サーバーエラー',
      unknown: '不明なエラー',
    },
    backup: {
      title: '暗号化バックアップ',
      description: 'ホスト・設定・AI Provider・MCP サーバー・Skill を 1 つの暗号化ファイルとしてエクスポート／復元します。マスターキーが必要です。',
      'locked-hint': '先にサインインしてください。暗号化バックアップにはパスワードから導出されるマスターキーが必要です。',
      export: 'エクスポート…',
      import: '復元…',
      exporting: 'バックアップを暗号化して書き込み中…',
      importing: 'バックアップを読み込み復号化中…',
      'export-success': 'バックアップを書き出しました。',
      'import-success': 'バックアップを復元しました。',
      'counts-summary': '{0} 件のレコードを含む',
      'import-confirm-title': '暗号化バックアップから復元しますか？',
      'import-confirm-description': '現在のすべてのホスト・設定・AI Provider・MCP サーバー・Skill をバックアップファイルの内容で置き換えます。この操作は取り消せません。',
      'import-confirm-action': '置換して復元',
      cancel: 'キャンセル',
    },
  },
};
