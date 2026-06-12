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
      localMachine: 'Local',
      intermediateHost: 'Relay',
      remoteHost: 'Remote',
      target: 'Destination',
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
      connectionFailed: 'The connection has failed. Please close this dialog and retry.',
      hostKey: {
        unknownTitle: 'Unknown host key',
        unknownSubtitle: 'The authenticity of this server has not been established. Verify the fingerprint before trusting it.',
        changedTitle: 'Host key has changed',
        changedSubtitle: 'A potential security breach was detected. The server may have been reinstalled, or the connection may be intercepted.',
        algorithm: 'Algorithm',
        fingerprint: 'Fingerprint',
        previousFingerprint: 'Previous fingerprint',
        addAndContinue: 'Add and continue',
        replace: 'Replace and continue',
        acceptOnce: 'Accept once',
        reject: 'Cancel',
      },
      keyboardInteractive: {
        title: 'Authentication required',
        submit: 'Submit',
        cancel: 'Cancel',
      },
      changePassword: {
        title: 'Password change required',
        placeholder: 'New password',
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
