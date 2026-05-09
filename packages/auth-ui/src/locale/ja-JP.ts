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
      email: 'メールアドレス',
      'email-placeholder': 'you@example.com',
      password: 'パスワード',
      'password-placeholder': 'マスターパスワード',
      'remember-me': 'このデバイスでサインインしたままにする',
      submit: 'サインイン',
      submitting: 'サインイン中…',
      'no-account': 'アカウントをお持ちでないですか？',
      'go-register': '新規登録',
    },
    register: {
      email: 'メールアドレス',
      'email-placeholder': 'you@example.com',
      'display-name': '表示名',
      'display-name-placeholder': 'どのようにお呼びすればよいですか？',
      'display-name-hint': '任意です。未入力の場合はメールアドレスの先頭部分を使用します。',
      password: 'マスターパスワード',
      'password-placeholder': '{0} 文字以上',
      'password-hint': 'このパスワードは同期データの暗号鍵を導出します。忘れた場合に復元する手段はありません。',
      'password-too-short': 'パスワードは {0} 文字以上必要です。',
      'password-mismatch': 'パスワードが一致しません。',
      confirm: 'パスワード（確認）',
      submit: 'アカウント作成',
      submitting: '作成中…',
      'have-account': 'すでにアカウントをお持ちですか？',
      'go-login': 'サインインへ',
    },
    account: {
      'email-verified': 'メール認証済み',
      'email-unverified': 'メール未認証',
      logout: 'サインアウト',
      'logging-out': 'サインアウト中…',
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
