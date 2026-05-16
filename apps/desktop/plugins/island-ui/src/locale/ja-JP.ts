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
  'island-ui': {
    session: {
      'todo-summary': 'タスク ({0} 完了, {1} 進行中, {2} 保留中)',
      'user-prompt-prefix': 'あなた: ',
      done: '完了',
      external: '外部',
      'empty-state': 'セッション待機中',
      'session-count': '{0} セッション',
    },
    permission: {
      'claude-asks': 'Claude からの質問',
      external: '外部',
      deny: '拒否',
      'permission-request': '権限リクエスト',
      allow: '許可',
      question: {
        next: '次へ',
        previous: '戻る',
        skip: 'スキップ',
        submit: '送信',
        progress: '{0}/{1}',
        'other-placeholder': 'その他…',
        'other-input-placeholder': '回答を入力…',
        'secret-placeholder': '入力してください',
        'select-all-that-apply': '該当するものをすべて選択してください。',
        'select-at-least-one': '少なくとも 1 つ選択してください。',
      },
    },
  },
};

export default locale;
