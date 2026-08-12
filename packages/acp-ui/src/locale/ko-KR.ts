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
    settings: {
      tab: 'Agent',
      'tab-description': 'Agent Client Protocol을 지원하는 코딩 Agent.',
      providers: 'Providers',
      'no-providers': '구성된 Provider가 없습니다.',
      'add-provider': 'Provider 추가',
      'search-providers': 'providers 검색',
      'no-matches': '일치하는 결과가 없습니다.',
      'install-guide': '설치 안내',
      add: '추가',
      remove: '제거',
      'model-count': 'Model {0}개',
      status: {
        available: '사용 가능',
        'on-demand': '첫 실행 시 다운로드',
        'not-installed': '설치되지 않음',
        disabled: '비활성화',
      },
      'search-models': 'Models 검색',
      discovered: '발견됨',
      'no-models': '이 Agent는 Model을 알리지 않습니다.',
      'not-probed': '새로고침하여 이 Agent가 지원하는 기능을 확인하세요.',
      'add-model': 'Model 추가',
      'model-id-placeholder': '예: anthropic/claude-opus-5',
      diagnose: '진단',
      refresh: '새로고침',
      'updated-at': '{0} 업데이트',
      'just-now': '방금',
      'minutes-ago': '{0}분 전',
      'hours-ago': '{0}시간 전',
      'days-ago': '{0}일 전',
    },
  },
};

export default locale;
