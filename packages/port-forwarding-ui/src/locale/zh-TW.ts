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
      bindAddressRemoteTip: 'To bind to all interfaces (0.0.0.0) for external access, set GatewayPorts to "yes" or "clientspecified" in the remote server\'s sshd_config.',
      intermediateHost: 'Intermediate host',
      remoteHost: 'Remote host',
      destinationAddress: 'Destination address',
      destinationPort: 'Destination port number',
      addHost: 'Hosts',
      removeHost: 'Remove Host',
    },
    diagram: {
      localMachine: '本機',
      intermediateHost: '中轉主機',
      remoteHost: '遠端主機',
      target: '目標',
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
      connectionFailed: '連線已失敗，請關閉此對話框後重試。',
      hostKey: {
        unknownTitle: '未知的主機金鑰',
        unknownSubtitle: '此伺服器的身分尚未驗證過。請確認指紋後再信任該伺服器。',
        changedTitle: '主機金鑰已變更',
        changedSubtitle: '偵測到潛在的安全風險。伺服器可能已重新安裝，或連線可能被攔截。',
        algorithm: '演算法',
        fingerprint: '指紋',
        previousFingerprint: '原指紋',
        addAndContinue: '新增並繼續',
        replace: '取代並繼續',
        acceptOnce: '僅本次接受',
        reject: '取消',
      },
      keyboardInteractive: {
        title: '需要驗證',
        submit: '提交',
        cancel: '取消',
      },
      changePassword: {
        title: '需要變更密碼',
        placeholder: '新密碼',
      },
    },
    confirm: {
      delete: {
        title: '刪除轉發規則',
        description: '此操作無法復原。',
      },
    },
  },
};

export default locale;
