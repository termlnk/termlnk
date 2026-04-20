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
  'extension-ui': {
    menu: { extensions: '확장' },
    action: {
      loadLocal: '로컬 확장 로드',
      refresh: '새로고침',
      enable: '활성화',
      disable: '비활성화',
      uninstall: '제거',
      remove: '삭제',
      reload: '다시 로드',
      selectDirectory: '확장 디렉토리 선택',
      installFromNpm: 'npm에서 설치',
    },
    empty: '설치된 확장이 없습니다',
    status: { activated: '활성', disabled: '비활성', error: '오류', installed: '설치됨' },
    tab: { installed: '설치됨', marketplace: '마켓플레이스' },
    marketplace: {
      search: '마켓플레이스 검색...',
      install: '설치',
      installed: '설치됨',
      installing: '설치 중',
      loadFailed: '마켓플레이스 로드 실패',
      empty: '사용 가능한 확장이 없습니다',
      emptyHint: '헤더의 다운로드 버튼으로 npm에서 직접 설치할 수 있습니다.',
      installs: '{0} 설치',
    },
    dialog: {
      installFromNpm: {
        title: 'npm에서 확장 설치',
        extensionId: '확장 ID',
        packageName: 'NPM 패키지',
        version: '버전',
        submit: '설치',
        cancel: '취소',
      },
    },
  },
};

export default locale;
