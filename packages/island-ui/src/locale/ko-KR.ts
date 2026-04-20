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
      'todo-summary': '작업 ({0} 완료, {1} 진행 중, {2} 대기 중)',
      'user-prompt-prefix': '나: ',
      done: '완료',
      external: '외부',
      'empty-state': '세션 대기 중',
      'session-count': '{0}개 세션',
    },
    permission: {
      'claude-asks': 'Claude 질문',
      external: '외부',
      deny: '거부',
      'permission-request': '권한 요청',
      allow: '허용',
    },
  },
};

export default locale;
