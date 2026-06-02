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
      'todo-summary': '任務 ({0} 已完成, {1} 進行中, {2} 待處理)',
      'user-prompt-prefix': '你: ',
      done: '完成',
      external: '外部',
      'empty-state': '等待工作階段',
      'session-count': '{0} 個工作階段',
    },
    permission: {
      'claude-asks': 'Claude 提問',
      external: '外部',
      deny: '拒絕',
      'permission-request': '權限請求',
      allow: '允許',
      question: {
        next: '下一題',
        previous: '上一題',
        skip: '跳過',
        submit: '完成',
        progress: '{0}/{1}',
        'other-placeholder': '其他…',
        'other-input-placeholder': '輸入自訂答案…',
        'secret-placeholder': '請輸入內容',
        'select-all-that-apply': '可多選。',
        'select-at-least-one': '請至少選擇一項。',
      },
    },
    'island-tab': {
      label: '動態島',
      description: '設定動態島通知和提示音',
      enable: '啟用動態島',
      'enable-description': '在 macOS 瀏海附近顯示浮動狀態覆蓋，展示 Agent 工作階段資訊',
      'sound-title': '聲音',
      'sound-enable': '啟用音效',
      'sound-volume': '音量',
      'category-session': '工作階段',
      'category-interaction': '互動',
      'category-system': '系統',
      'event-session-start': '工作階段開始',
      'event-session-start-description': '新的 Claude / Codex / Gemini 工作階段',
      'event-task-complete': '任務完成',
      'event-task-complete-description': 'AI 完成了本輪回覆',
      'event-task-error': '任務錯誤',
      'event-task-error-description': '工具失敗或 API 錯誤',
      'event-needs-approval': '需要審批',
      'event-needs-approval-description': '等待權限審批或回答問題',
      'event-task-confirmed': '任務確認',
      'event-task-confirmed-description': '你傳送了一則訊息',
      'event-context-limit': '上下文限制',
      'event-context-limit-description': '上下文視窗壓縮中',
      'event-rapid-submit': '連續提交偵測',
      'event-rapid-submit-description': '10 秒內傳送了 3+ 則訊息',
    },
  },
};

export default locale;
