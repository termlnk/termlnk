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
    settings: {
      tab: 'Agent',
      'tab-description': 'Agent Client Protocol に対応したコーディング Agent。',
      providers: 'Providers',
      'no-providers': 'Provider が設定されていません。',
      'add-provider': 'Provider を追加',
      'search-providers': 'providers を検索',
      'no-matches': '一致する結果がありません。',
      'install-guide': 'インストール手順',
      add: '追加',
      remove: '削除',
      'model-count': 'Model {0} 件',
      status: {
        available: '利用可能',
        'on-demand': '初回実行時にダウンロード',
        'not-installed': '未インストール',
        disabled: '無効',
      },
      'search-models': 'Models を検索',
      discovered: '検出済み',
      'no-models': 'この Agent は Model を公開していません。',
      'not-probed': '更新して、この Agent の対応機能を問い合わせます。',
      'add-model': 'Model を追加',
      'model-id-placeholder': '例: anthropic/claude-opus-5',
      diagnose: '診断',
      refresh: '更新',
      'updated-at': '{0}に更新',
      'just-now': 'たった今',
      'minutes-ago': '{0}分前',
      'hours-ago': '{0}時間前',
      'days-ago': '{0}日前',
    },
  },
};

export default locale;
