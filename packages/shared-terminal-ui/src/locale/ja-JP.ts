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
      'co-pilot': '共同作業者',
      observer: '閲覧者',
    },
    'join-dialog': {
      title: 'マルチプレイヤーの招待を受信しました',
      description: '誰かがターミナルセッションを共有しました。参加前に招待内容を確認してください。',
      'session-label': 'セッション',
      'role-label': '役割',
      'expires-label': '期限',
      'copy-url': 'URL をコピー',
      join: 'セッションに参加',
      dismiss: '閉じる',
      unparsable: 'この招待 URL を解析できませんでした。発信者に再送を依頼してください。',
      'join-failed': 'セッションへの参加に失敗しました:',
    },
    remote: {
      'tab-name': '共有セッション',
      'viewing-only': '閲覧のみ',
      driving: '操作中',
      'waiting-for-frames': 'ホストからの最初のフレームを待っています…',
      'read-only-hint': '閲覧者として参加しました。「キーボード取得」ボタンでドライバー権を申請できます。',
      'driver-hint': 'キーボードを取得しました。入力はホストの端末で実行されます。「解放」で戻せます。',
      'request-keyboard': 'キーボード取得',
      'release-keyboard': 'キーボード解放',
      state: {
        pairing: 'ホストとペアリング中…',
        connecting: 'リレーに接続中…',
        connected: '接続済み',
        disconnected: '切断',
        error: '接続エラー',
      },
    },
  },
};

export default locale;
