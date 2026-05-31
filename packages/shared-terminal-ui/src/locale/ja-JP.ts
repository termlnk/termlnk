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
  'shared-terminal-ui': {
    'invite-role': {
      owner: 'オーナー',
      'co-pilot': 'エディター',
      observer: 'ビューア',
    },
    'join-dialog': {
      title: 'マルチプレイヤーの招待を受信しました',
      description: '誰かがターミナルセッションを共有しました。参加前に招待内容を確認してください。',
      'session-label': 'セッション',
      'role-label': '役割',
      'expires-label': '期限',
      'copy-url': 'URL をコピー',
      join: 'セッションに参加',
      joining: '参加中...',
      dismiss: '閉じる',
      unparsable: 'この招待 URL を解析できませんでした。発信者に再送を依頼してください。',
      'join-failed': 'セッションへの参加に失敗しました:',
      'error-invite-not-active': 'この招待リンクはすでに使用済み、または無効です。ホストに新しい招待リンクの送信を依頼してください。',
    },
    remote: {
      'tab-name': '共有セッション',
      'viewing-only': '閲覧のみ',
      driving: '操作中',
      'waiting-for-frames': 'ホストからの最初のフレームを待っています…',
      'read-only-hint': 'ビューアとして参加しました。「キーボード取得」で操作権をリクエストできます。',
      'driver-hint': 'キーボードを操作しています。入力はホストの端末で実行されます。「キーボード解放」で操作権を返せます。',
      'request-keyboard': 'キーボード取得',
      'release-keyboard': 'キーボード解放',
      'view-only-badge': '閲覧のみの共有',
      'view-only-hint': 'ホストは閲覧専用モードでこのセッションを共有しています。入力が必要な場合はホストに「入力を許可」への切り替えを依頼してください。',
      popover: {
        'aria-label': '共有セッションの操作',
      },
      state: {
        pairing: 'ホストとペアリング中…',
        connecting: 'リレーに接続中…',
        connected: '接続済み',
        disconnected: '切断',
        error: '接続エラー',
        idle: '参加待ち…',
      },
      toast: {
        'self-acquired': '操作権を取得しました。入力を開始してください。',
        released: 'キーボードを解放しました。',
        'taken-by-other': '他の参加者が操作中です。',
      },
    },
  },
};

export default locale;
