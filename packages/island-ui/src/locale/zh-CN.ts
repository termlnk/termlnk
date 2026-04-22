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
        'secret-placeholder': '请输入内容',
        'select-all-that-apply': '可多选。',
      },
    },
  },
};

export default locale;
