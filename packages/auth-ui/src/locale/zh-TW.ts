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
    switch: {
      'to-register-prompt': '還沒有帳號？',
      'to-register-action': '註冊',
      'to-login-prompt': '已有帳號？',
      'to-login-action': '登入',
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
      google: '使用 Google 繼續',
      'or-divider': '或',
    },
    vault: {
      'setup-title': '設定加密密碼',
      'setup-subtitle': '此密碼用於端對端加密你的同步資料。它獨立於你的 Google 帳號，一旦遺失將無法復原。',
      'unlock-title': '解鎖你的資料',
      'unlock-subtitle': '輸入加密密碼以在本裝置上解密你的同步資料。',
      password: '加密密碼',
      'password-placeholder': '至少 {0} 個字元',
      confirm: '確認密碼',
      'confirm-placeholder': '再次輸入密碼',
      'too-short': '請至少使用 {0} 個字元。',
      mismatch: '兩次輸入的密碼不一致。',
      warning: '如果忘記此密碼，你的同步資料將無法復原。',
      'setup-submit': '設定密碼並繼續',
      'unlock-submit': '解鎖',
      submitting: '處理中…',
      'sign-out': '改為登出',
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
    'account-dialog': {
      title: '帳號',
      'tooltip-login': '登入 / 註冊',
      'tooltip-account': '帳號',
      'sync-title': '雲端同步',
      'sync-description': '同步引擎的執行狀態及各資源的同步進度',
      back: '返回',
    },
    gate: {
      'unavailable-title': '雲端同步未設定',
      'unavailable-detail': '目前版本尚未連接雲端服務；服務可用後將在此處顯示登入入口。',
    },
    'change-password': {
      title: '修改密碼',
      subtitle: '更新你的帳號密碼。其他所有裝置將被登出。',
      current: '目前密碼',
      'current-placeholder': '輸入目前密碼',
      new: '新密碼',
      'new-placeholder': '至少 {0} 個字元',
      confirm: '確認新密碼',
      'confirm-placeholder': '再次輸入新密碼',
      'too-short': '密碼至少需要 {0} 個字元。',
      mismatch: '兩次輸入的密碼不一致。',
      warning: '修改密碼後，所有其他裝置將被登出。它們需要使用新密碼重新登入。',
      submit: '修改密碼',
      submitting: '修改中…',
      success: '密碼修改成功。',
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
