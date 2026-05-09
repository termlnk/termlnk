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
    login: {
      email: '이메일',
      'email-placeholder': 'you@example.com',
      password: '비밀번호',
      'password-placeholder': '마스터 비밀번호',
      'remember-me': '이 기기에서 로그인 상태 유지',
      submit: '로그인',
      submitting: '로그인 중…',
      'no-account': '계정이 없으신가요?',
      'go-register': '회원가입',
    },
    register: {
      email: '이메일',
      'email-placeholder': 'you@example.com',
      'display-name': '표시 이름',
      'display-name-placeholder': '어떻게 불러드리면 될까요?',
      'display-name-hint': '선택 사항입니다. 비워두면 이메일 앞부분이 사용됩니다.',
      password: '마스터 비밀번호',
      'password-placeholder': '최소 {0}자',
      'password-hint': '이 비밀번호는 모든 동기화 데이터의 암호화 키를 파생하는 데 사용됩니다. 잊으면 복구할 수 없습니다.',
      'password-too-short': '비밀번호는 최소 {0}자 이상이어야 합니다.',
      'password-mismatch': '비밀번호가 일치하지 않습니다.',
      confirm: '비밀번호 확인',
      submit: '계정 생성',
      submitting: '생성 중…',
      'have-account': '이미 계정이 있으신가요?',
      'go-login': '로그인',
    },
    account: {
      'email-verified': '이메일 인증됨',
      'email-unverified': '이메일 미인증',
      logout: '로그아웃',
      'logging-out': '로그아웃 중…',
    },
    gate: {
      'unavailable-title': '클라우드 동기화가 구성되지 않았습니다',
      'unavailable-detail': '현재 빌드에는 클라우드 서버가 구성되어 있지 않습니다. 구성된 후 로그인 항목이 표시됩니다.',
    },
  },
};
