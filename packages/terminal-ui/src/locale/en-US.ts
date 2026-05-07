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
  'terminal-ui': {
    menu: {
      host: 'Hosts',
    },
    'hosts-explorer': {
      title: 'Hosts Explorer',
      'add-host': 'New host',
      'add-group': 'New group',
      refresh: 'Refresh',
      'context-menu': {
        rename: 'Rename',
        delete: 'Delete',
      },
    },
    'host-dialog': {
      title: {
        create: 'Create Host',
        edit: 'Edit Host',
      },
      tab: {
        basic: 'Basic Info',
        credential: 'Credential',
        proxy: 'Proxy',
        hostChain: 'Host Chain',
        advanced: 'Advanced',
      },
      field: {
        label: 'Name',
        addr: 'Address',
        port: 'Port',
        username: 'Username',
        password: 'Password',
        privateKey: 'Private Key',
        parentGroup: 'Group',
        rootGroup: 'Root',
      },
      credential: {
        type: 'Auth Type',
        password: 'Password',
        rsa: 'SSH Key',
      },
      proxy: {
        enable: 'Enable Proxy',
        type: 'Proxy Type',
        host: 'Proxy Host',
        port: 'Proxy Port',
      },
      hostChain: {
        title: 'Host Chain',
        description: 'Connect to the target via the bastion hosts in order.',
        usage: '{0} / {1}',
        localNode: 'Local',
        targetNode: 'Target',
        targetUnnamed: 'this host',
        addPlaceholder: 'Add a bastion',
        searchPlaceholder: 'Search by name or address...',
        noMatches: 'No matching hosts',
        empty: 'No bastion configured. Connect directly to the target.',
        loading: 'Loading hosts...',
        noAvailable: 'No host available',
        maxReached: 'Maximum chain depth reached ({0})',
        missing: 'host removed',
        dragHandle: 'Drag to reorder',
        removeBastion: 'Remove bastion',
      },
      delete: {
        title: 'Delete host',
        confirm: 'Delete',
        cancel: 'Cancel',
        message: 'Are you sure to delete "{0}"?',
      },
      advanced: {
        timeout: 'Connect Timeout(ms)',
        heartbeat: 'Heartbeat Interval(ms)',
        x11Forward: 'X11 Forwarding',
        termType: 'Terminal Type',
        encode: 'Encoding',
        fontFamily: 'Font',
        fontSize: 'Font Size',
        fontDefault: 'Default',
        runScript: 'Run Script',
        runScriptPlaceholder: '# Script to run after connection',
      },
      btn: {
        test: 'Test Connection',
        cancel: 'Cancel',
        create: 'Create',
        edit: 'Save',
      },
      test: {
        success: 'Connection successful ({0}ms)',
        failed: 'Connection failed: {0}',
        validationFailed: 'Please complete the connection info first',
      },
      validation: {
        labelRequired: 'Name is required',
        addrRequired: 'Address is required',
        addrInvalid: 'Please enter a valid IP address or hostname',
        portMin: 'Port must be at least 1',
        portMax: 'Port must be at most 65535',
        portInvalid: 'Port must be an integer',
        usernameRequired: 'Username is required',
        privateKeyRequired: 'Private key is required',
        proxyHostRequired: 'Proxy host is required',
        proxyPortRequired: 'Proxy port is required',
        timeoutMin: 'Timeout must be at least 1000ms',
        heartbeatMin: 'Heartbeat must be at least 1000ms',
        fontSizeMin: 'Font size must be at least 8',
        fontSizeMax: 'Font size must be at most 24',
        hostChainMaxDepth: 'Host chain depth exceeds limit',
        hostChainSelfRef: 'A host cannot reference itself in its host chain',
        hostChainDuplicate: 'Duplicate host in host chain',
      },
    },
    connection: {
      step: {
        connect: 'Connect',
        chain: 'Jump',
        verify: 'Verify',
        shell: 'Shell',
      },
      status: {
        connecting: 'Connecting...',
        authenticating: 'Handshake complete. Authenticating...',
        openingShell: 'Opening shell...',
        auth: 'Authentication required.',
        authFailed: 'Authentication failed. Please retry.',
        ready: 'Opening shell...',
        error: 'Connection failed',
      },
      action: {
        close: 'Close',
        retry: 'Retry',
        continue: 'Continue',
        replace: 'Replace',
        addNew: 'Add as new',
        cancel: 'Cancel',
      },
      password: {
        title: 'Password',
        placeholder: 'Password',
        remember: 'Save password for this host',
        viaHop: 'via {0}',
      },
      fingerprint: {
        title: 'The fingerprint for {0} has changed',
        subtitle: 'A potential security breach was detected.',
        label: 'New {0} fingerprint is',
      },
      hop: {
        connecting: 'Connecting jump host {0} ({1}/{2})...',
        authenticating: 'Authenticating jump host {0} ({1}/{2})...',
        failed: 'Jump host {0} failed: {1}',
      },
      logs: {
        title: 'Connection logs',
      },
    },
    drop: {
      hint: 'Drop files to paste path',
    },
    progress: {
      title: 'Terminal Progress',
      source: 'OSC 9;4',
      indeterminateValue: '--',
      state: {
        running: 'Running',
        error: 'Error',
        indeterminate: 'Indeterminate',
        paused: 'Paused',
      },
    },
    group: {
      'default-name': 'New Group',
    },
    shortcuts: {
      'apply-error-fix': 'Apply AI error-fix suggestion',
      'close-active-tab': 'Close Active Tab',
      'create-new-host': 'Create New Host',
      'delete-host': 'Delete Host',
      'maximize-session': 'Maximize/Restore Session',
      'open-local-terminal': 'New Local Terminal',
    },
    pane: {
      'split-right': 'Split right',
      'split-down': 'Split down',
      maximize: 'Maximize',
      restore: 'Restore',
      close: 'Close',
    },
    'tab-bar': {
      'new-session': 'New terminal',
      'close-session': 'Close terminal',
      'tab-list': 'Show tab list',
    },
  },
};

export default locale;
