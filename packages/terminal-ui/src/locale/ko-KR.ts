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
        hostChain: '점프 호스트',
        advanced: '고급 설정',
      },
      field: {
        label: '이름',
        addr: '주소',
        port: '포트',
        username: '사용자명',
        password: '비밀번호',
        privateKey: '개인 키',
        passwordKeepBlank: '비워두면 현재 비밀번호 유지',
        privateKeyKeepBlank: '비워두면 현재 개인 키 유지',
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
      hostChain: {
        title: '점프 체인',
        description: '아래 점프 호스트를 순서대로 거쳐 대상에 연결합니다.',
        usage: '{0} / {1}',
        localNode: '로컬',
        targetNode: '대상',
        targetUnnamed: '현재 호스트',
        addPlaceholder: '점프 호스트 추가',
        searchPlaceholder: '호스트 이름 또는 주소 검색...',
        noMatches: '일치하는 호스트가 없습니다',
        empty: '점프 호스트가 설정되지 않았습니다. 대상에 직접 연결됩니다.',
        loading: '호스트 목록 로딩 중...',
        noAvailable: '사용 가능한 호스트가 없습니다',
        maxReached: '점프 체인 최대 깊이({0})에 도달했습니다',
        missing: '호스트가 삭제됨',
        dragHandle: '끌어서 순서 변경',
        removeBastion: '이 점프 호스트 제거',
      },
      delete: {
        title: '호스트 삭제',
        confirm: '삭제',
        cancel: '취소',
        message: '"{0}"을(를) 삭제하시겠습니까?',
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
        hostChainMaxDepth: '점프 체인 깊이가 한계를 초과했습니다',
        hostChainSelfRef: '호스트는 자기 자신을 점프 호스트로 사용할 수 없습니다',
        hostChainDuplicate: '점프 체인에 중복된 호스트가 있습니다',
      },
    },
    connection: {
      step: {
        connect: '연결',
        chain: '점프',
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
        viaHop: '경유: {0}',
      },
      fingerprint: {
        title: '{0}의 지문이 변경되었습니다',
        subtitle: '잠재적인 보안 위험이 감지되었습니다.',
        label: '새로운 {0} 지문',
      },
      hop: {
        connecting: '점프 호스트 {0} 연결 중 ({1}/{2})...',
        authenticating: '점프 호스트 {0} 인증 중 ({1}/{2})...',
        failed: '점프 호스트 {0} 연결 실패: {1}',
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
      'apply-error-fix': 'AI 오류 수정 제안 적용',
      'close-active-tab': '현재 탭 닫기',
      'create-new-host': '새 호스트 생성',
      'delete-host': '호스트 삭제',
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
      'close-session': '터미널 닫기',
      'tab-list': '탭 목록 표시',
    },
    multiplayer: {
      tooltip: '멀티플레이어',
      title: '멀티플레이어',
      'copy-link': '링크 복사',
      stop: '멀티플레이어 중지',
      'hint-empty': '링크를 복사하여 이 터미널 세션을 공유하세요. 참여자는 여기에 표시됩니다.',
      participants: '참여자:',
      you: '나',
      'take-keyboard': '키보드 가져오기',
      'release-keyboard': '키보드 반환',
      copied: '복사됨',
      'copy-failed': '링크 복사에 실패했습니다. 네트워크 또는 로그인 상태를 확인하세요.',
      policy: {
        label: '공유 모드',
        'allow-input': '입력 허용',
        'allow-input-hint': '참여자가 키보드를 요청할 수 있습니다. 한 번에 한 사람만 입력할 수 있습니다.',
        'view-only': '읽기 전용',
        'view-only-hint': '참여자는 보기만 가능하고 입력할 수 없습니다. 데모에 적합합니다.',
        'locked-hint': '공유 중에는 모드가 고정됩니다. 모드를 전환하려면 공유를 중지하세요.',
      },
    },
  },
};

export default locale;
