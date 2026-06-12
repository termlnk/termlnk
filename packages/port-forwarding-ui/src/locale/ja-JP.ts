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

const locale = {
  'port-forwarding-ui': {
    menu: {
      title: 'Port Forwarding',
    },
    list: {
      empty: 'No port forwarding rules. Click "+" to create one.',
      newLocal: 'Local Forwarding',
      newRemote: 'Remote Forwarding',
      newDynamic: 'Dynamic Forwarding',
    },
    editor: {
      title: 'Port Forwarding',
      typeLocal: 'Local',
      typeRemote: 'Remote',
      typeDynamic: 'Dynamic',
      label: 'Label',
      localPort: 'Local port number',
      remotePort: 'Remote port number',
      bindAddress: 'Bind address',
      bindAddressRemoteTip: 'すべてのインターフェース（0.0.0.0）にバインドして外部アクセスを許可するには、リモートサーバーの sshd_config で GatewayPorts を yes または clientspecified に設定してください。',
      intermediateHost: 'Intermediate host',
      remoteHost: 'Remote host',
      destinationAddress: 'Destination address',
      destinationPort: 'Destination port number',
      addHost: 'Hosts',
      removeHost: 'Remove Host',
    },
    diagram: {
      localMachine: 'ローカル',
      intermediateHost: '中継ホスト',
      remoteHost: 'リモート',
      target: 'ターゲット',
    },
    status: {
      idle: 'Idle',
      starting: 'Starting',
      authenticating: 'Authenticating',
      active: 'Active',
      failed: 'Failed',
      stopping: 'Stopping',
      closed: 'Closed',
    },
    action: {
      start: 'Start',
      stop: 'Stop',
      restart: 'Restart',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      create: 'Create',
    },
    auth: {
      connectionFailed: '接続に失敗しました。このダイアログを閉じてからやり直してください。',
      hostKey: {
        unknownTitle: '不明なホスト鍵',
        unknownSubtitle: 'このサーバーの真正性は確認されていません。信頼する前にフィンガープリントを確認してください。',
        changedTitle: 'ホスト鍵が変更されました',
        changedSubtitle: 'セキュリティ上の問題が検出されました。サーバーが再インストールされたか、接続が傍受されている可能性があります。',
        algorithm: 'アルゴリズム',
        fingerprint: 'フィンガープリント',
        previousFingerprint: '以前のフィンガープリント',
        addAndContinue: '追加して続行',
        replace: '置換して続行',
        acceptOnce: '今回のみ許可',
        reject: 'キャンセル',
      },
      keyboardInteractive: {
        title: '認証が必要です',
        submit: '送信',
        cancel: 'キャンセル',
      },
      changePassword: {
        title: 'パスワードの変更が必要です',
        placeholder: '新しいパスワード',
      },
    },
    confirm: {
      delete: {
        title: 'Delete forwarding rule',
        description: 'This action cannot be undone.',
      },
    },
  },
};

export default locale;
