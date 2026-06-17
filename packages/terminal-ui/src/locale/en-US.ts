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
        passwordKeepBlank: 'Leave blank to keep current password',
        privateKeyKeepBlank: 'Leave blank to keep current private key',
        parentGroup: 'Group',
        rootGroup: 'Root',
      },
      credential: {
        type: 'Auth Type',
        password: 'Password',
        rsa: 'Private Key',
        key: 'Key',
        identity: 'Identity',
        keyMissing: 'Selected key no longer exists. Please pick another.',
        identityMissing: 'Selected identity no longer exists. Please pick another.',
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
        keyRequired: 'Please select a key',
        identityRequired: 'Please select an identity',
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
        acceptOnce: 'Connect once',
        addAndContinue: 'Add and continue',
        cancel: 'Cancel',
      },
      password: {
        title: 'Password',
        placeholder: 'Password',
        remember: 'Save password for this host',
        viaHop: 'via {0}',
      },
      fingerprint: {
        unknown: {
          title: 'Unknown host key',
          subtitle: 'This server\'s identity has not been verified before. Confirm the fingerprint before trusting it.',
        },
        changed: {
          title: 'The host key has changed',
          subtitle: 'A potential security breach was detected. The server may have been reinstalled, or the connection may be intercepted.',
        },
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
    keychain: {
      title: 'Keychain',
      tab: {
        keys: 'Keys',
        identities: 'Identities',
      },
      action: {
        newKey: 'New key',
        generate: 'Generate key',
        newIdentity: 'New identity',
        reveal: 'Reveal private key',
        cancel: 'Cancel',
        save: 'Save',
      },
      empty: {
        keys: 'No keys yet. Generate or import an SSH key.',
        identities: 'No identities yet.',
      },
      field: {
        label: 'Label',
        algorithm: 'Key type',
        bits: 'Bits',
        publicKey: 'Public key',
        privateKey: 'Private key',
        passphrase: 'Passphrase',
        savePassphrase: 'Save passphrase',
        cipher: 'Cipher',
        rounds: 'Rounds',
        roundsHelp: 'Higher rounds strengthen the private key but slow passphrase verification.',
        certificate: 'Certificate (optional)',
        username: 'Username',
        password: 'Password',
        key: 'Key',
        noKey: 'No key',
      },
      key: {
        generateTitle: 'Generate key',
        newKeyTitle: 'New key',
        editTitle: 'Edit key',
      },
      identity: {
        newTitle: 'New identity',
        editTitle: 'Edit identity',
        keyMissing: 'Selected key no longer exists.',
      },
    },
    knownHosts: {
      title: 'Known Hosts',
      empty: 'No known hosts yet. Host keys are remembered after the first connection.',
      action: {
        clearAll: 'Clear all',
      },
      confirm: {
        clearAllTitle: 'Clear all known hosts',
        clearAllDesc: 'Remove all {0} known host keys? You will need to verify each host again on the next connection.',
        delete: 'Clear',
        cancel: 'Cancel',
      },
      detail: {
        title: 'Host Key Details',
        host: 'Host',
        port: 'Port',
        keyType: 'Key type',
        fingerprint: 'Fingerprint',
        publicKey: 'Public key',
        close: 'Close',
      },
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
      'select-tab': 'Select Tab by Index',
      'split-down': 'Split Down',
      'split-right': 'Split Right',
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
    multiplayer: {
      tooltip: 'Multiplayer',
      title: 'Multiplayer',
      'copy-link': 'Copy link',
      stop: 'Stop multiplayer',
      'hint-empty': 'Copy link to share this terminal session. People who join will be visible here.',
      participants: 'Participants:',
      you: 'You',
      'take-keyboard': 'Take keyboard',
      'release-keyboard': 'Release keyboard',
      copied: 'Copied',
      copying: 'Copying...',
      'copy-failed': 'Failed to copy link. Check your network or sign-in.',
      policy: {
        label: 'Share mode',
        'allow-input': 'Allow input',
        'allow-input-hint': 'Joiners can request the keyboard. Only one person types at a time.',
        'view-only': 'View only',
        'view-only-hint': 'Joiners can watch but cannot type. Recommended for demos.',
      },
    },
  },
};

export default locale;
