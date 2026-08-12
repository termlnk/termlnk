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
      'local-terminal': '로컬 터미널 새로 만들기',
      agents: 'AI Agent',
      'on-demand': '온디맨드',
      'manage-agents': 'Agent 관리…',
    },
    session: {
      stop: '중지',
      connecting: '연결 중…',
      'message-placeholder': 'Agent에게 메시지 보내기…',
    },
    launch: {
      'failed-title': '{0}을(를) 시작할 수 없습니다',
      'failed-body-title': 'Agent 시작에 실패했습니다',
      retry: '다시 시도',
    },
  },
};

export default locale;
