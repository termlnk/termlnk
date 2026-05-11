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
      start: '録画',
      stop: '停止',
    },
    'session-state': {
      idle: '待機中',
      active: 'アクティブ',
      recording: '録画中',
      closed: '終了',
    },
  },
};

export default locale;
