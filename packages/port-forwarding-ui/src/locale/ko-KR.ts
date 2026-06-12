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
      bindAddressRemoteTip: '외부 접속을 위해 모든 인터페이스(0.0.0.0)에 바인딩하려면 원격 서버의 sshd_config에서 GatewayPorts를 yes 또는 clientspecified로 설정하세요.',
      intermediateHost: 'Intermediate host',
      remoteHost: 'Remote host',
      destinationAddress: 'Destination address',
      destinationPort: 'Destination port number',
      addHost: 'Hosts',
      removeHost: 'Remove Host',
    },
    diagram: {
      localMachine: '로컬',
      intermediateHost: '중계 호스트',
      remoteHost: '원격',
      target: '대상',
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
      connectionFailed: '연결에 실패했습니다. 이 대화상자를 닫고 다시 시도하세요.',
      hostKey: {
        unknownTitle: '알 수 없는 호스트 키',
        unknownSubtitle: '이 서버의 신원이 확인되지 않았습니다. 신뢰하기 전에 지문을 확인하세요.',
        changedTitle: '호스트 키가 변경됨',
        changedSubtitle: '잠재적인 보안 위험이 감지되었습니다. 서버가 재설치되었거나 연결이 가로채졌을 수 있습니다.',
        algorithm: '알고리즘',
        fingerprint: '지문',
        previousFingerprint: '이전 지문',
        addAndContinue: '추가하고 계속',
        replace: '교체하고 계속',
        acceptOnce: '이번만 허용',
        reject: '취소',
      },
      keyboardInteractive: {
        title: '인증 필요',
        submit: '제출',
        cancel: '취소',
      },
      changePassword: {
        title: '비밀번호 변경 필요',
        placeholder: '새 비밀번호',
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
