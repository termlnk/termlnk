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
      question: {
        next: '다음',
        previous: '이전',
        skip: '건너뛰기',
        submit: '제출',
        progress: '{0}/{1}',
        'other-placeholder': '기타…',
        'other-input-placeholder': '답변을 입력하세요…',
        'secret-placeholder': '내용을 입력하세요',
        'select-all-that-apply': '해당되는 것을 모두 선택하세요.',
        'select-at-least-one': '최소 하나 이상 선택해 주세요.',
      },
    },
    'island-tab': {
      label: '다이나믹 아일랜드',
      description: '다이나믹 아일랜드 알림 및 사운드 설정',
      enable: '다이나믹 아일랜드 활성화',
      'enable-description': 'macOS 노치 근처에 플로팅 상태 오버레이를 표시하여 에이전트 세션 정보 표시',
      'sound-title': '사운드',
      'sound-enable': '사운드 활성화',
      'sound-volume': '볼륨',
      'category-session': '세션',
      'category-interaction': '인터랙션',
      'category-system': '시스템',
      'event-session-start': '세션 시작',
      'event-session-start-description': '새 Claude / Codex / Gemini 세션',
      'event-task-complete': '작업 완료',
      'event-task-complete-description': 'AI가 이번 응답을 완료',
      'event-task-error': '작업 오류',
      'event-task-error-description': '도구 실패 또는 API 오류',
      'event-needs-approval': '승인 필요',
      'event-needs-approval-description': '권한 승인 또는 질문 답변 대기 중',
      'event-task-confirmed': '작업 확인',
      'event-task-confirmed-description': '메시지를 전송했습니다',
      'event-context-limit': '컨텍스트 제한',
      'event-context-limit-description': '컨텍스트 윈도우 압축 중',
      'event-rapid-submit': '연속 전송 감지',
      'event-rapid-submit-description': '10초 이내 3건 이상 메시지 전송',
    },
  },
};

export default locale;
