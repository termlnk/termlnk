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
      title: '歡迎使用 Termlnk',
      subtitle: '登入或註冊，同步你的主機與設定。',
    },
    tabs: {
      login: '登入',
      register: '註冊',
    },
    login: {
      email: '信箱',
      'email-placeholder': 'you@example.com',
      password: '密碼',
      'password-placeholder': '請輸入你的密碼',
      'trust-banner': '密碼僅在本機派生，不會傳送至伺服器。',
      'remember-me': '在本裝置保持登入',
      submit: '登入',
      submitting: '登入中…',
    },
    register: {
      email: '信箱',
      'email-placeholder': 'you@example.com',
      'display-name': '顯示名稱',
      'display-name-placeholder': '希望我們怎麼稱呼你？',
      'display-name-hint': '可選。留空時以信箱前綴顯示。',
      password: '密碼',
      'password-placeholder': '至少 {0} 位',
      'password-hint': '此密碼用於派生所有同步資料的加密金鑰。一旦遺忘無法找回。',
      'password-too-short': '密碼至少需要 {0} 位。',
      'password-mismatch': '兩次輸入的密碼不一致。',
      confirm: '確認密碼',
      submit: '註冊',
      submitting: '註冊中…',
    },
    account: {
      'email-verified': '信箱已驗證',
      'email-unverified': '信箱未驗證',
      'joined-at': '加入於 {0}',
      logout: '登出',
      'logging-out': '登出中…',
    },
    gate: {
      'unavailable-title': '雲端同步未設定',
      'unavailable-detail': '目前版本尚未連接雲端服務；服務可用後將在此處顯示登入入口。',
    },
    devices: {
      title: '已登入裝置',
      description: '當前帳號下的所有已登入裝置。如果有不認得的裝置，請立即撤銷。',
      refresh: '重新整理',
      empty: '目前沒有已登入裝置。',
      'this-device': '當前裝置',
      'unnamed-device': '未命名裝置',
      'last-seen': '最近活躍 {0}',
      created: '加入於 {0}',
      revoke: '撤銷',
      revoking: '撤銷中…',
      cancel: '取消',
      'revoke-confirm-title': '撤銷此裝置？',
      'revoke-confirm-current': '"{0}" 是你正在使用的裝置。撤銷後會很快被登出。',
      'revoke-confirm-other': '"{0}" 將被強制登出，下次重新整理時需要重新登入。',
      'gated-hint': '登入後可管理裝置清單。',
      time: {
        'just-now': '剛剛',
        'minutes-ago': '{0} 分鐘前',
        'hours-ago': '{0} 小時前',
        'days-ago': '{0} 天前',
      },
    },
  },
};
