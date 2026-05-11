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
    tab: {
      label: '공유 터미널',
      description: '공유 세션 확인, 초대 링크 생성, 로컬 녹화를 관리합니다.',
    },
    panel: {
      title: '공유 터미널',
      unavailable: '현재 런타임에서 공유 터미널 서비스를 사용할 수 없습니다.',
    },
    invite: {
      create: '초대',
      copy: '링크 복사',
    },
    sessions: {
      title: '세션',
      description: '초대 링크로 미러링할 수 있는 활성 PTY 세션입니다.',
      empty: '활성 공유 PTY 세션이 없습니다.',
      participants: '참가자 {0}명',
      driver: 'Driver {0}',
    },
    recording: {
      active: '녹화 중',
      start: '녹화',
      stop: '중지',
    },
    'session-state': {
      idle: '대기',
      active: '활성',
      recording: '녹화 중',
      closed: '닫힘',
    },
    driver: {
      label: '드라이버: {0}',
      none: '없음',
      locked: '잠김',
      typing: '입력 중',
      'other-writers': '추가로 {0}명의 쓰기 권한 참가자가 연결됨',
      take: '키보드 가져오기',
      release: '키보드 놓기',
      lock: '나로 잠금',
      unlock: '잠금 해제',
    },
  },
};

export default locale;
