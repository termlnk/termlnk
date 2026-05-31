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
  'shared-terminal-ui': {
    'invite-role': {
      owner: '소유자',
      'co-pilot': '편집자',
      observer: '뷰어',
    },
    'join-dialog': {
      title: '멀티플레이어 초대를 받았습니다',
      description: '누군가 터미널 세션을 공유했습니다. 참여하기 전에 초대 내용을 확인하세요.',
      'session-label': '세션',
      'role-label': '역할',
      'expires-label': '만료 시간',
      'copy-url': 'URL 복사',
      join: '세션 참여',
      joining: '참여 중...',
      dismiss: '닫기',
      unparsable: '이 초대 URL을 분석할 수 없습니다. 발신자에게 재전송을 요청하세요.',
      'join-failed': '세션 참여에 실패했습니다:',
      'error-invite-not-active': '이 초대 링크는 이미 사용되었거나 더 이상 활성 상태가 아닙니다. 호스트에게 새 초대 링크를 요청하세요.',
    },
    remote: {
      'tab-name': '공유 세션',
      'viewing-only': '읽기 전용',
      driving: '제어 중',
      'waiting-for-frames': '호스트의 첫 출력 대기 중…',
      'read-only-hint': '뷰어로 참여했습니다. "키보드 요청"으로 제어권을 요청할 수 있습니다.',
      'driver-hint': '키보드를 제어하고 있습니다. 입력은 호스트의 터미널에서 실행됩니다. "키보드 해제"로 제어권을 돌려줄 수 있습니다.',
      'request-keyboard': '키보드 요청',
      'release-keyboard': '키보드 해제',
      'view-only-badge': '읽기 전용 공유',
      'view-only-hint': '호스트가 읽기 전용 모드로 이 세션을 공유했습니다. 입력이 필요하면 호스트에게 "입력 허용" 모드로 전환을 요청하세요.',
      popover: {
        'aria-label': '공유 세션 제어',
      },
      state: {
        pairing: '호스트와 페어링 중…',
        connecting: '릴레이에 연결 중…',
        connected: '연결됨',
        disconnected: '연결 해제됨',
        error: '연결 오류',
        idle: '참여 대기 중…',
      },
      toast: {
        'self-acquired': '제어권을 받았습니다. 입력을 시작하세요.',
        released: '키보드가 해제되었습니다.',
        'taken-by-other': '다른 참가자가 터미널을 제어 중입니다.',
      },
    },
  },
};

export default locale;
