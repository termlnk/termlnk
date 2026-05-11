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
    tab: {
      label: '共有ターミナル',
      description: '共有セッションの確認、招待リンクの作成、ローカル録画を管理します。',
    },
    panel: {
      title: '共有ターミナル',
      unavailable: 'このランタイムでは共有ターミナルサービスを利用できません。',
    },
    invite: {
      create: '招待',
      copy: 'リンクをコピー',
    },
    sessions: {
      title: 'セッション',
      description: '招待リンクでミラーできるアクティブな PTY セッションです。',
      empty: 'アクティブな共有 PTY セッションはありません。',
      participants: '{0} 人の参加者',
      driver: 'Driver {0}',
    },
    recording: {
      active: '録画中',
      mandatory: '録画 (必須)',
      'mandatory-hint': '監査者が接続中は録画を停止できません。先に監査者を切断してください。',
      start: '録画',
      stop: '停止',
    },
    'session-state': {
      idle: '待機中',
      active: 'アクティブ',
      recording: '録画中',
      closed: '終了',
    },
    driver: {
      label: '操作中: {0}',
      none: 'なし',
      locked: 'ロック中',
      typing: '入力中',
      'other-writers': '他に {0} 人の書き込み参加者',
      take: 'キーボードを取得',
      release: 'キーボードを解放',
      lock: '自分に固定',
      unlock: 'ロック解除',
    },
  },
};

export default locale;
