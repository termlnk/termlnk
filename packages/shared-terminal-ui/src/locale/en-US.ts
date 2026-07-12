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
  'shared-terminal-ui': {
    'invite-role': {
      owner: 'owner',
      'co-pilot': 'editor',
      observer: 'viewer',
    },
    'join-dialog': {
      title: 'Multiplayer invite received',
      description: 'Someone shared a terminal session with you. Review the invite below before joining.',
      'session-label': 'Session',
      'role-label': 'Role',
      'expires-label': 'Expires',
      'copy-url': 'Copy URL',
      join: 'Join session',
      joining: 'Joining...',
      dismiss: 'Dismiss',
      unparsable: 'This invite URL could not be parsed. Ask the host to resend.',
      'join-failed': 'Could not join the session:',
      'error-invite-not-active': 'This invite has already been used or is no longer active. Ask the host to send a new invite link.',
      'error-anonymous-join-unavailable': 'Unable to join as a guest: the server does not currently allow anonymous joining. Sign in and try again, or contact the person who shared this session.',
    },
    remote: {
      'tab-name': 'Shared session',
      'viewing-only': 'Viewing only',
      driving: 'In control',
      'waiting-for-frames': 'Waiting for the host\'s first frame…',
      'read-only-hint': 'You joined as a viewer. Press "Request keyboard" to ask for control.',
      'driver-hint': 'You are in control of the keyboard. Your keystrokes execute on the host\'s terminal; press "Release keyboard" to hand it back.',
      'request-keyboard': 'Request keyboard',
      'release-keyboard': 'Release keyboard',
      'view-only-badge': 'View-only share',
      'view-only-hint': 'The host shared this session in view-only mode. Ask them to switch to "Allow input" if you need to type.',
      popover: {
        'aria-label': 'Shared session controls',
      },
      state: {
        pairing: 'Pairing with host…',
        connecting: 'Connecting to relay…',
        connected: 'Connected',
        disconnected: 'Disconnected',
        error: 'Connection error',
        idle: 'Waiting to join…',
      },
      toast: {
        'self-acquired': 'You\'ve got remote control. Start typing.',
        released: 'Keyboard released.',
        'taken-by-other': 'Someone else is driving the terminal now.',
      },
    },
  },
};

export default locale;
