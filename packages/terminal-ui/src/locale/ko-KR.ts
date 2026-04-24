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
  'terminal-ui': {
    menu: {
      host: 'Hosts',
    },
    'hosts-explorer': {
      title: '호스트 탐색기',
      'add-host': '호스트 추가',
      'add-group': '그룹 추가',
      refresh: '새로고침',
      'context-menu': {
        rename: '이름 바꾸기',
        delete: '삭제',
      },
    },
    'host-dialog': {
      title: {
        create: '호스트 생성',
        edit: '호스트 편집',
      },
      tab: {
        basic: '기본 정보',
        credential: '인증',
        proxy: '프록시',
        advanced: '고급 설정',
      },
      field: {
        label: '이름',
        addr: '주소',
        port: '포트',
        username: '사용자명',
        password: '비밀번호',
        privateKey: '개인 키',
        parentGroup: '그룹',
        rootGroup: '루트',
      },
      credential: {
        type: '인증 방식',
        password: '비밀번호 인증',
        rsa: 'SSH 키 인증',
      },
      proxy: {
        enable: '프록시 활성화',
        type: '프록시 유형',
        host: '프록시 호스트',
        port: '프록시 포트',
      },
      advanced: {
        timeout: '연결 타임아웃(ms)',
        heartbeat: '하트비트 간격(ms)',
        x11Forward: 'X11 포워딩',
        termType: '터미널 유형',
        encode: '인코딩',
        fontFamily: '글꼴',
        fontSize: '글꼴 크기',
        fontDefault: '기본값',
        runScript: '연결 후 스크립트',
        runScriptPlaceholder: '# 연결 후 실행할 스크립트',
      },
      btn: {
        test: '연결 테스트',
        cancel: '취소',
        create: '생성',
        edit: '저장',
      },
      test: {
        success: '연결 성공 ({0}ms)',
        failed: '연결 실패: {0}',
        validationFailed: '연결 정보를 먼저 입력해 주세요',
      },
      validation: {
        labelRequired: '이름은 필수입니다',
        addrRequired: '주소는 필수입니다',
        addrInvalid: '유효한 IP 주소 또는 호스트명을 입력하세요',
        portMin: '포트 번호는 1 이상이어야 합니다',
        portMax: '포트 번호는 65535 이하여야 합니다',
        portInvalid: '포트 번호는 정수여야 합니다',
        usernameRequired: '사용자명은 필수입니다',
        privateKeyRequired: '개인 키는 필수입니다',
        proxyHostRequired: '프록시 호스트는 필수입니다',
        proxyPortRequired: '프록시 포트는 필수입니다',
        timeoutMin: '타임아웃은 최소 1000ms여야 합니다',
        heartbeatMin: '하트비트는 최소 1000ms여야 합니다',
        fontSizeMin: '글꼴 크기는 최소 8이어야 합니다',
        fontSizeMax: '글꼴 크기는 최대 24여야 합니다',
      },
    },
    connection: {
      step: {
        connect: '연결',
        verify: '검증',
        shell: '셸',
      },
      status: {
        connecting: '연결 중...',
        authenticating: '핸드셰이크 완료. 인증 중...',
        openingShell: '셸 시작 중...',
        auth: '인증이 필요합니다.',
        authFailed: '인증에 실패했습니다. 다시 시도하세요.',
        ready: '셸 시작 중...',
        error: '연결 실패',
      },
      action: {
        close: '닫기',
        retry: '재시도',
        continue: '계속',
        replace: '교체',
        addNew: '새 지문으로 추가',
        cancel: '취소',
      },
      password: {
        title: '비밀번호',
        placeholder: '비밀번호 입력',
        remember: '이 호스트의 비밀번호 저장',
      },
      fingerprint: {
        title: '{0}의 지문이 변경되었습니다',
        subtitle: '잠재적인 보안 위험이 감지되었습니다.',
        label: '새로운 {0} 지문',
      },
      logs: {
        title: '연결 로그',
      },
    },
    drop: {
      hint: '파일을 드롭하여 경로 붙여넣기',
    },
    progress: {
      title: '터미널 진행률',
      source: 'OSC 9;4',
      indeterminateValue: '--',
      state: {
        running: '실행 중',
        error: '오류',
        indeterminate: '불확정',
        paused: '일시 정지',
      },
    },
    group: {
      'default-name': '새 그룹',
    },
    shortcuts: {
      'close-active-tab': '현재 탭 닫기',
      'create-new-host': '새 호스트 생성',
      'maximize-session': '세션 최대화/복원',
      'open-local-terminal': '새 로컬 터미널',
    },
    pane: {
      'split-right': '오른쪽으로 분할',
      'split-down': '아래로 분할',
      maximize: '최대화',
      restore: '복원',
      close: '닫기',
    },
    'tab-bar': {
      'new-session': '새 터미널',
      'tab-list': '탭 목록 표시',
    },
  },
};

export default locale;
