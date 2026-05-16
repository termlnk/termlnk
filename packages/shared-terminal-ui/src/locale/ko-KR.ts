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
      mandatory: '녹화 (필수)',
      'mandatory-hint': '감사자가 연결 중에는 녹화를 중지할 수 없습니다. 먼저 감사자를 분리하세요.',
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
    'recording-policy': {
      title: '녹화 정책',
      description: '새 협업 세션의 기본 녹화 동작입니다. 감사자가 참여하면 항상 강제로 녹화됩니다.',
      'default-on': '기본 녹화 사용',
      'default-on-hint': '새 협업 세션이 자동으로 녹화됩니다.',
    },
    'outstanding-invites': {
      title: '활성 초대',
      description: '아직 사용할 수 있는 초대 링크입니다. 폐기하면 더 이상 사용할 수 없습니다.',
      unavailable: '이 환경에서는 초대 관리를 사용할 수 없습니다.',
      empty: '활성 초대가 없습니다.',
    },
    'invite-history': {
      title: '초대 기록',
      description: '사용됨 / 폐기됨 / 만료된 초대 기록입니다.',
      empty: '과거 초대가 없습니다.',
    },
    'invite-row': {
      'single-use': '일회용',
      session: '세션 {0}',
      'expires-at': '만료 {0}',
      'expired-at': '{0}에 만료',
      'consumed-at': '{0}에 사용됨',
      'revoked-at': '{0}에 폐기됨',
      revoke: '폐기',
    },
    'invite-status': {
      active: '활성',
      consumed: '사용됨',
      revoked: '폐기됨',
      expired: '만료됨',
    },
    'invite-role': {
      owner: '소유자',
      'co-pilot': '협업자',
      observer: '관찰자',
      auditor: '감사자',
    },
  },
};

export default locale;
