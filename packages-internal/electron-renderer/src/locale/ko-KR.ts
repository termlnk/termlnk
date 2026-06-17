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
  'electron-renderer': {
    header: {
      'pin-enable': '창 고정',
      'pin-disable': '창 고정 해제',
    },
    'platform-tab': {
      label: '플랫폼',
      description: 'OS 수준 통합: 트레이, 로그인 시 자동 실행, 화면 전원 관리',
      'tray-enable': '시스템 트레이 활성화',
      'tray-enable-description': '시스템 알림 영역에 앱 아이콘을 표시하고 빠른 접근 메뉴 제공',
      'close-to-tray': '트레이로 최소화',
      'close-to-tray-description': '창을 닫을 때 앱을 종료하지 않고 시스템 트레이로 숨기기',
      'startup-title': '시작',
      'auto-launch': '로그인 시 실행',
      'auto-launch-description': '시스템 로그인 시 Termlnk 자동 시작',
      'keep-awake-title': '화면 깨우기 유지',
      'keep-awake-description': 'Agent 세션이 실행 중일 때 화면이 꺼지지 않도록 유지',
    },
  },
};

export default locale;
