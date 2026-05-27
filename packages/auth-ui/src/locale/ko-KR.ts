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

export default {
  'auth-ui': {
    welcome: {
      title: 'Termlnk에 오신 것을 환영합니다',
      subtitle: '로그인하거나 계정을 만들어 호스트와 설정을 동기화하세요.',
    },
    tabs: {
      login: '로그인',
      register: '회원가입',
    },
    login: {
      email: '이메일',
      'email-placeholder': 'you@example.com',
      password: '비밀번호',
      'password-placeholder': '비밀번호를 입력하세요',
      'trust-banner': '비밀번호는 로컬에서 파생되며 서버로 전송되지 않습니다.',
      'remember-me': '이 기기에서 로그인 상태 유지',
      submit: '로그인',
      submitting: '로그인 중…',
    },
    register: {
      email: '이메일',
      'email-placeholder': 'you@example.com',
      'display-name': '표시 이름',
      'display-name-placeholder': '어떻게 불러드리면 될까요?',
      'display-name-hint': '선택 사항입니다. 비워두면 이메일 앞부분이 사용됩니다.',
      password: '비밀번호',
      'password-placeholder': '최소 {0}자',
      'password-hint': '이 비밀번호는 모든 동기화 데이터의 암호화 키를 파생하는 데 사용됩니다. 잊으면 복구할 수 없습니다.',
      'password-too-short': '비밀번호는 최소 {0}자 이상이어야 합니다.',
      'password-mismatch': '비밀번호가 일치하지 않습니다.',
      confirm: '비밀번호 확인',
      submit: '계정 생성',
      submitting: '생성 중…',
    },
    account: {
      'email-verified': '이메일 인증됨',
      'email-unverified': '이메일 미인증',
      'joined-at': '가입일 {0}',
      logout: '로그아웃',
      'logging-out': '로그아웃 중…',
    },
    gate: {
      'unavailable-title': '클라우드 동기화가 구성되지 않았습니다',
      'unavailable-detail': '현재 빌드에는 클라우드 서버가 구성되어 있지 않습니다. 구성된 후 로그인 항목이 표시됩니다.',
    },
    devices: {
      title: '활성 기기',
      description: '이 계정으로 로그인된 기기 목록입니다. 본인 기기가 아니면 즉시 해지하세요.',
      refresh: '새로 고침',
      empty: '활성 기기가 없습니다.',
      'this-device': '현재 기기',
      'unnamed-device': '이름 없는 기기',
      'last-seen': '최근 접속 {0}',
      created: '추가 {0}',
      revoke: '해지',
      revoking: '해지 중…',
      cancel: '취소',
      'revoke-confirm-title': '이 기기를 해지하시겠습니까?',
      'revoke-confirm-current': '"{0}" 은(는) 현재 사용 중인 기기입니다. 해지하면 곧 로그아웃됩니다.',
      'revoke-confirm-other': '"{0}" 은(는) 강제 로그아웃되며 다음 토큰 갱신 시 재로그인이 필요합니다.',
      'gated-hint': '로그인 후 기기를 관리할 수 있습니다.',
      time: {
        'just-now': '방금',
        'minutes-ago': '{0} 분 전',
        'hours-ago': '{0} 시간 전',
        'days-ago': '{0} 일 전',
      },
    },
  },
};
