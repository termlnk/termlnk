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
      'todo-summary': '任务 ({0} 已完成, {1} 进行中, {2} 待处理)',
      'user-prompt-prefix': '你: ',
      done: '完成',
      external: '外部',
      'empty-state': '等待会话',
      'session-count': '{0} 个会话',
    },
    permission: {
      'claude-asks': 'Claude 提问',
      external: '外部',
      deny: '拒绝',
      'permission-request': '权限请求',
      allow: '允许',
      question: {
        next: '下一题',
        previous: '上一题',
        skip: '跳过',
        submit: '完成',
        progress: '{0}/{1}',
        'other-placeholder': '其他…',
        'other-input-placeholder': '输入自定义答案…',
        'secret-placeholder': '请输入内容',
        'select-all-that-apply': '可多选。',
        'select-at-least-one': '请至少选择一项。',
      },
    },
    'island-tab': {
      label: '灵动岛',
      description: '配置灵动岛通知和提示音',
      enable: '启用灵动岛',
      'enable-description': '在 macOS 刘海附近显示浮动状态覆盖，展示 Agent 会话信息',
      'sound-title': '声音',
      'sound-enable': '启用音效',
      'sound-volume': '音量',
      'category-session': '会话',
      'category-interaction': '交互',
      'category-system': '系统',
      'event-session-start': '会话开始',
      'event-session-start-description': '新的 Claude / Codex / Gemini 会话',
      'event-task-complete': '任务完成',
      'event-task-complete-description': 'AI 完成了本轮回复',
      'event-task-error': '任务错误',
      'event-task-error-description': '工具失败或 API 错误',
      'event-needs-approval': '需要审批',
      'event-needs-approval-description': '等待权限审批或回答问题',
      'event-task-confirmed': '任务确认',
      'event-task-confirmed-description': '你发送了一条消息',
      'event-context-limit': '上下文限制',
      'event-context-limit-description': '上下文窗口压缩中',
      'event-rapid-submit': '连续提交检测',
      'event-rapid-submit-description': '10 秒内发送了 3+ 条消息',
    },
  },
};

export default locale;
