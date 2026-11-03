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
      'local-terminal': '新建本機終端',
      agents: 'AI Agent',
      'on-demand': '按需下載',
      'manage-agents': '管理 Agent…',
    },
    session: {
      stop: '停止',
      connecting: '連線中…',
      'message-placeholder': '向 Agent 傳送訊息…',
    },
    launch: {
      'failed-title': '無法啟動 {0}',
      'failed-body-title': 'Agent 啟動失敗',
      retry: '重試',
    },
    settings: {
      tab: 'Agent',
      'tab-description': '支援 Agent Client Protocol 的程式設計 Agent。',
      providers: 'Providers',
      'no-providers': '尚未設定任何 Provider。',
      'add-provider': '新增 Provider',
      'search-providers': '搜尋 providers',
      'no-matches': '沒有相符的結果。',
      'install-guide': '安裝說明',
      add: '新增',
      remove: '移除',
      'model-count': '{0} 個 Model',
      status: {
        available: '可用',
        'on-demand': '首次執行時下載',
        'not-installed': '未安裝',
        disabled: '已停用',
      },
      'search-models': '搜尋 Models',
      discovered: '已發現',
      'no-models': '該 Agent 未宣告任何 Model。',
      'not-probed': '點擊重新整理以詢問該 Agent 支援哪些能力。',
      'add-model': '新增 Model',
      'model-id-placeholder': '例如 anthropic/claude-opus-5',
      diagnose: '診斷',
      refresh: '重新整理',
      'updated-at': '已更新 {0}',
      'just-now': '剛剛',
      'minutes-ago': '{0} 分鐘前',
      'hours-ago': '{0} 小時前',
      'days-ago': '{0} 天前',
    },
  },
};

export default locale;
