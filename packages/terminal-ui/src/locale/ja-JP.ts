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
      title: 'ホストエクスプローラー',
      'add-host': 'ホストを追加',
      'add-group': 'グループを追加',
      refresh: '更新',
      'context-menu': {
        rename: '名前の変更',
        delete: '削除',
      },
    },
    'host-dialog': {
      title: {
        create: 'ホストを作成',
        edit: 'ホストを編集',
      },
      tab: {
        basic: '基本情報',
        credential: '認証',
        proxy: 'プロキシ',
        hostChain: '踏み台ホスト',
        advanced: '詳細設定',
      },
      field: {
        label: '名前',
        addr: 'アドレス',
        port: 'ポート',
        username: 'ユーザー名',
        password: 'パスワード',
        privateKey: '秘密鍵',
        passwordKeepBlank: '空欄のままで現在のパスワードを保持',
        privateKeyKeepBlank: '空欄のままで現在の秘密鍵を保持',
        parentGroup: 'グループ',
        rootGroup: 'ルート',
      },
      credential: {
        type: '認証方式',
        password: 'パスワード認証',
        rsa: 'SSH鍵認証',
      },
      proxy: {
        enable: 'プロキシを有効化',
        type: 'プロキシ種別',
        host: 'プロキシホスト',
        port: 'プロキシポート',
      },
      hostChain: {
        title: '踏み台チェーン',
        description: '以下の踏み台ホストを順番に経由してターゲットへ接続します。',
        usage: '{0} / {1}',
        localNode: 'ローカル',
        targetNode: 'ターゲット',
        targetUnnamed: '現在のホスト',
        addPlaceholder: '踏み台を追加',
        searchPlaceholder: 'ホスト名やアドレスを検索...',
        noMatches: '一致するホストがありません',
        empty: '踏み台ホストが未設定です。ターゲットに直接接続します。',
        loading: 'ホスト一覧を読み込み中...',
        noAvailable: '利用可能なホストがありません',
        maxReached: '踏み台チェーンの最大段数（{0}）に達しました',
        missing: 'ホストが削除されました',
        dragHandle: 'ドラッグして並び替え',
        removeBastion: 'この踏み台を削除',
      },
      delete: {
        title: 'ホストを削除',
        confirm: '削除',
        cancel: 'キャンセル',
        message: '"{0}" を削除してもよろしいですか？',
      },
      advanced: {
        timeout: '接続タイムアウト(ms)',
        heartbeat: 'ハートビート間隔(ms)',
        x11Forward: 'X11転送',
        termType: 'ターミナルタイプ',
        encode: 'エンコーディング',
        fontFamily: 'フォント',
        fontSize: 'フォントサイズ',
        fontDefault: 'デフォルト',
        runScript: '接続後スクリプト',
        runScriptPlaceholder: '# 接続後に実行するスクリプト',
      },
      btn: {
        test: '接続テスト',
        cancel: 'キャンセル',
        create: '作成',
        edit: '保存',
      },
      test: {
        success: '接続成功 ({0}ms)',
        failed: '接続失敗: {0}',
        validationFailed: '接続情報を入力してください',
      },
      validation: {
        labelRequired: '名前は必須です',
        addrRequired: 'アドレスは必須です',
        addrInvalid: '有効なIPアドレスまたはホスト名を入力してください',
        portMin: 'ポート番号は1以上にしてください',
        portMax: 'ポート番号は65535以下にしてください',
        portInvalid: 'ポート番号は整数で入力してください',
        usernameRequired: 'ユーザー名は必須です',
        privateKeyRequired: '秘密鍵は必須です',
        proxyHostRequired: 'プロキシホストは必須です',
        proxyPortRequired: 'プロキシポートは必須です',
        timeoutMin: 'タイムアウトは1000ms以上にしてください',
        heartbeatMin: 'ハートビートは1000ms以上にしてください',
        fontSizeMin: 'フォントサイズは8以上にしてください',
        fontSizeMax: 'フォントサイズは24以下にしてください',
        hostChainMaxDepth: '踏み台チェーンの段数が上限を超えています',
        hostChainSelfRef: 'ホスト自身を踏み台に指定できません',
        hostChainDuplicate: '踏み台チェーンに重複するホストがあります',
      },
    },
    connection: {
      step: {
        connect: '接続',
        chain: '踏み台',
        verify: '検証',
        shell: 'シェル',
      },
      status: {
        connecting: '接続中...',
        authenticating: 'ハンドシェイク完了。認証中...',
        openingShell: 'シェルを起動中...',
        auth: '認証が必要です。',
        authFailed: '認証に失敗しました。再試行してください。',
        ready: 'シェルを起動中...',
        error: '接続に失敗しました',
      },
      action: {
        close: '閉じる',
        retry: '再試行',
        continue: '続行',
        replace: '置換',
        addNew: '新しいフィンガープリントとして追加',
        cancel: 'キャンセル',
      },
      password: {
        title: 'パスワード',
        placeholder: 'パスワードを入力',
        remember: 'このホストのパスワードを保存',
        viaHop: '経由: {0}',
      },
      fingerprint: {
        title: '{0} のフィンガープリントが変更されました',
        subtitle: 'セキュリティ上のリスクが検出されました。',
        label: '新しい {0} フィンガープリント',
      },
      hop: {
        connecting: '踏み台 {0} に接続中 ({1}/{2})...',
        authenticating: '踏み台 {0} を認証中 ({1}/{2})...',
        failed: '踏み台 {0} の接続に失敗しました: {1}',
      },
      logs: {
        title: '接続ログ',
      },
    },
    drop: {
      hint: 'ファイルをドロップしてパスを貼り付け',
    },
    progress: {
      title: 'ターミナル進捗',
      source: 'OSC 9;4',
      indeterminateValue: '--',
      state: {
        running: '実行中',
        error: 'エラー',
        indeterminate: '不定',
        paused: '一時停止',
      },
    },
    group: {
      'default-name': '新しいグループ',
    },
    shortcuts: {
      'apply-error-fix': 'AI エラー修復提案を適用',
      'close-active-tab': 'アクティブタブを閉じる',
      'create-new-host': '新しいホストを作成',
      'delete-host': 'ホストを削除',
      'maximize-session': 'セッションの最大化/復元',
      'open-local-terminal': '新しいローカルターミナル',
      'select-tab': 'インデックスでタブを選択',
      'split-down': '下に分割',
      'split-right': '右に分割',
    },
    pane: {
      'split-right': '右に分割',
      'split-down': '下に分割',
      maximize: '最大化',
      restore: '元に戻す',
      close: '閉じる',
    },
    'tab-bar': {
      'new-session': '新しいターミナル',
      'close-session': 'ターミナルを閉じる',
      'tab-list': 'タブ一覧を表示',
    },
    multiplayer: {
      tooltip: 'マルチプレイヤー',
      title: 'マルチプレイヤー',
      'copy-link': 'リンクをコピー',
      stop: 'マルチプレイヤーを停止',
      'hint-empty': 'リンクをコピーしてこの端末セッションを共有します。参加者はここに表示されます。',
      participants: '参加者：',
      you: 'あなた',
      'take-keyboard': 'キーボードを取得',
      'release-keyboard': 'キーボードを解放',
      copied: 'コピー済み',
      copying: 'コピー中...',
      'copy-failed': 'リンクのコピーに失敗しました。ネットワークまたはサインイン状態を確認してください。',
      policy: {
        label: '共有モード',
        'allow-input': '入力を許可',
        'allow-input-hint': '参加者はキーボードをリクエストできます。同時に入力できるのは 1 名のみです。',
        'view-only': '閲覧のみ',
        'view-only-hint': '参加者は閲覧のみで入力できません。デモに最適です。',
      },
    },
  },
};

export default locale;
