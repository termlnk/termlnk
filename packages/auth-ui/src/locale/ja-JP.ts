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
      title: 'Termlnk へようこそ',
      subtitle: 'サインインまたは新規登録して、ホストと設定を同期しましょう。',
    },
    switch: {
      'to-register-prompt': 'アカウントをお持ちでないですか？',
      'to-register-action': '新規登録',
      'to-login-prompt': 'すでにアカウントをお持ちですか？',
      'to-login-action': 'サインイン',
    },
    login: {
      email: 'メールアドレス',
      'email-placeholder': 'you@example.com',
      password: 'パスワード',
      'password-placeholder': 'パスワードを入力',
      'trust-banner': 'パスワードはローカルで派生され、サーバーに送信されることはありません。',
      'remember-me': 'このデバイスでサインインしたままにする',
      submit: 'サインイン',
      submitting: 'サインイン中…',
      google: 'Google で続行',
      'or-divider': 'または',
    },
    vault: {
      'setup-title': '暗号化パスワードを設定',
      'setup-subtitle': 'このパスワードは同期データをエンドツーエンドで暗号化します。Google アカウントとは別のもので、紛失すると復元できません。',
      'unlock-title': 'データのロックを解除',
      'unlock-subtitle': '暗号化パスワードを入力して、このデバイスで同期データを復号します。',
      password: '暗号化パスワード',
      'password-placeholder': '{0} 文字以上',
      confirm: 'パスワードの確認',
      'confirm-placeholder': 'パスワードを再入力',
      'too-short': '{0} 文字以上で入力してください。',
      mismatch: 'パスワードが一致しません。',
      warning: 'このパスワードを忘れると、同期データは復元できません。',
      'setup-submit': 'パスワードを設定して続行',
      'unlock-submit': 'ロック解除',
      submitting: '処理中…',
      'sign-out': '代わりにサインアウト',
    },
    register: {
      email: 'メールアドレス',
      'email-placeholder': 'you@example.com',
      'display-name': '表示名',
      'display-name-placeholder': 'どのようにお呼びすればよいですか？',
      'display-name-hint': '任意です。未入力の場合はメールアドレスの先頭部分を使用します。',
      password: 'パスワード',
      'password-placeholder': '{0} 文字以上',
      'password-hint': 'このパスワードは同期データの暗号鍵を導出します。忘れた場合に復元する手段はありません。',
      'password-too-short': 'パスワードは {0} 文字以上必要です。',
      'password-mismatch': 'パスワードが一致しません。',
      confirm: 'パスワード（確認）',
      submit: 'アカウント作成',
      submitting: '作成中…',
    },
    account: {
      'email-verified': 'メール認証済み',
      'email-unverified': 'メール未認証',
      'joined-at': '登録日 {0}',
      logout: 'サインアウト',
      'logging-out': 'サインアウト中…',
    },
    'account-dialog': {
      title: 'アカウント',
      'tooltip-login': 'ログイン / 登録',
      'tooltip-account': 'アカウント',
      'sync-title': 'クラウド同期',
      'sync-description': '同期エンジンの状態と各リソースの同期進捗。',
    },
    gate: {
      'unavailable-title': 'クラウド同期は未設定です',
      'unavailable-detail': 'このビルドではクラウドサーバーが構成されていません。設定後にサインイン項目が表示されます。',
    },
    devices: {
      title: 'アクティブなデバイス',
      description: 'このアカウントにサインインしているデバイス一覧。心当たりのないものはすぐに失効させてください。',
      refresh: '再読み込み',
      empty: 'アクティブなデバイスはありません。',
      'this-device': 'このデバイス',
      'unnamed-device': '名前のないデバイス',
      'last-seen': '最終アクセス {0}',
      created: '登録日 {0}',
      revoke: '失効させる',
      revoking: '失効処理中…',
      cancel: 'キャンセル',
      'revoke-confirm-title': 'このデバイスを失効させますか？',
      'revoke-confirm-current': '"{0}" は現在使用中のデバイスです。失効するとまもなくサインアウトされます。',
      'revoke-confirm-other': '"{0}" は強制的にサインアウトされ、次回更新時に再ログインが必要になります。',
      'gated-hint': 'サインインするとデバイスを管理できます。',
      time: {
        'just-now': 'たった今',
        'minutes-ago': '{0} 分前',
        'hours-ago': '{0} 時間前',
        'days-ago': '{0} 日前',
      },
    },
  },
};
