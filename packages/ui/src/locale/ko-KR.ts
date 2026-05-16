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
  ui: {
    'notification-panel': {
      title: '알림',
      filter: {
        all: '전체',
        unread: '읽지 않음',
      },
      actions: {
        'mark-all-read': '모두 읽음',
        'mark-all-read-title': '모두 읽음으로 표시',
        'clear-all-title': '모두 지우기',
        'mark-read-title': '읽음으로 표시',
        'remove-title': '삭제',
      },
      empty: '알림이 없습니다',
      source: {
        prefix: '출처: {0}',
        terminal: '터미널',
        system: '시스템',
        extension: '확장',
        application: '애플리케이션',
        agent: 'Agent',
      },
      time: {
        'just-now': '방금',
        'minutes-ago': '{0}분 전',
        'hours-ago': '{0}시간 전',
        'days-ago': '{0}일 전',
      },
      footer: {
        total: '알림 {0}건',
        unread: '읽지 않은 알림 {0}건',
        'total-with-unread': '알림 {0}건, 읽지 않은 알림 {1}건',
      },
    },
    'notification-icon': {
      title: '알림',
      'unread-title': '읽지 않은 알림 {0}건',
    },
    'right-sidebar-toggle': {
      'open-title': '오른쪽 사이드바 열기',
      'close-title': '오른쪽 사이드바 닫기',
    },
    'left-sidebar-toggle': {
      'open-title': '왼쪽 사이드바 표시',
      'close-title': '왼쪽 사이드바 숨기기',
    },
    updater: {
      'dialog-title': '새 버전 사용 가능',
      'new-version-available': '새 버전 사용 가능',
      'update-ready': '업데이트 준비 완료',
      'release-notes': '릴리스 노트',
      'download-update': '업데이트 다운로드',
      downloading: '다운로드 중...',
      'install-now': '지금 설치',
      retry: '재시도',
      'manual-update-hint': '새 버전이 있습니다. 최신 docker 이미지를 pull하거나 git pull을 실행하여 업데이트하십시오 - 브라우저 배포에서는 앱 내 설치가 지원되지 않습니다.',
    },
  },
};

export default locale;
