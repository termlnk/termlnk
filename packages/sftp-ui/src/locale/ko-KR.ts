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
  'sftp-ui': {
    menu: { sftp: 'SFTP' },
    connection: {
      title: 'SFTP 연결',
      status: { connecting: '연결 중...', authenticating: '인증 중...', opening: 'SFTP 열는 중...', ready: '연결됨', error: '연결 실패' },
      action: { close: '닫기', retry: '재시도', continue: '계속' },
      password: { title: '비밀번호 필요', placeholder: '비밀번호 입력' },
    },
    browser: { local: '로컬', remote: '원격', empty: '빈 디렉토리', loading: '로딩 중...', items: '{count}개 항목', selected: '{count}개 선택됨' },
    file: { name: '이름', size: '크기', modified: '수정 날짜', permissions: '권한' },
    action: { download: '다운로드', upload: '업로드', rename: '이름 변경', delete: '삭제', newFolder: '새 폴더', permissions: '권한', refresh: '새로고침' },
    transfer: { title: '전송', clearCompleted: '완료된 전송 지우기' },
    dialog: {
      rename: { title: '이름 변경' },
      newFolder: { title: '새 폴더', placeholder: '폴더 이름' },
      permissions: { title: '권한', owner: '소유자', group: '그룹', others: '기타', read: '읽기', write: '쓰기', execute: '실행', octal: '8진수' },
    },
  },
};

export default locale;
