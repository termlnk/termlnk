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
    },
  },
};

export default locale;
