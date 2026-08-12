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
  'acp-ui': {
    'new-session': {
      'local-terminal': 'ローカルターミナルを新規作成',
      agents: 'AI Agent',
      'on-demand': 'オンデマンド',
      'manage-agents': 'Agent を管理…',
    },
    session: {
      stop: '停止',
      connecting: '接続中…',
      'message-placeholder': 'Agent にメッセージを送信…',
    },
    launch: {
      'failed-title': '{0} を起動できませんでした',
      'failed-body-title': 'Agent の起動に失敗しました',
      retry: '再試行',
    },
  },
};

export default locale;
