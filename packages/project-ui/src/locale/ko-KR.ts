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
  'project-ui': {
    explorer: {
      title: '파일',
      empty: '로컬 터미널 또는 ACP 세션을 열어 파일을 탐색하세요.',
      filter: '파일 필터…',
      refresh: '새로고침',
      'show-hidden': '숨김 파일 표시',
      'hide-hidden': '숨김 파일 감추기',
    },
    changes: {
      title: '변경',
      uncommitted: '커밋되지 않음 {0}개',
      clean: '변경 사항이 없습니다.',
      'no-diff': '텍스트 차이가 없습니다.',
      'staged-count': '스테이징 {0}개',
      'switch-branch': '브랜치 전환',
      'collapse-all': '모두 접기',
      'expand-all': '모두 펼치기',
      'view-flat': '평면 목록',
      'view-tree': '트리',
    },
    git: {
      title: 'Git',
      empty: '프로젝트 컨텍스트 없음.',
      'not-a-repo': 'Git 저장소가 아닙니다.',
      staged: '스테이징됨',
      changes: '변경 사항',
      stage: '스테이징',
      unstage: '스테이징 해제',
      commit: '커밋',
      'commit-message': '커밋 메시지',
      diff: '차이',
      'close-diff': '닫기',
    },
    shortcuts: {
      'toggle-explorer': '탐색기 전환',
      'toggle-git': 'Git 전환',
    },
  },
};

export default locale;
