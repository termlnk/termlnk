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
      email: '信箱',
      'email-placeholder': 'you@example.com',
      password: '密碼',
      'password-placeholder': '主密碼',
      'remember-me': '在本裝置保持登入',
      submit: '登入',
      submitting: '登入中…',
      'no-account': '還沒有帳號？',
      'go-register': '立即註冊',
    },
    register: {
      email: '信箱',
      'email-placeholder': 'you@example.com',
      'display-name': '顯示名稱',
      'display-name-placeholder': '希望我們怎麼稱呼你？',
      'display-name-hint': '可選。留空時以信箱前綴顯示。',
      password: '主密碼',
      'password-placeholder': '至少 {0} 位',
      'password-hint': '此密碼用於派生所有同步資料的加密金鑰。一旦遺忘無法找回。',
      'password-too-short': '密碼至少需要 {0} 位。',
      'password-mismatch': '兩次輸入的密碼不一致。',
      confirm: '確認密碼',
      submit: '註冊',
      submitting: '註冊中…',
      'have-account': '已有帳號？',
      'go-login': '直接登入',
    },
    account: {
      'email-verified': '信箱已驗證',
      'email-unverified': '信箱未驗證',
      logout: '登出',
      'logging-out': '登出中…',
    },
    gate: {
      'unavailable-title': '雲端同步未設定',
      'unavailable-detail': '目前版本尚未連接雲端服務；服務可用後將在此處顯示登入入口。',
    },
  },
};
