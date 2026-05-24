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
      'co-pilot': 'co-pilot',
      observer: 'observer',
    },
    'join-dialog': {
      title: 'Multiplayer invite received',
      description: 'Someone shared a terminal session with you. Review the invite below before joining.',
      'session-label': 'Session',
      'role-label': 'Role',
      'expires-label': 'Expires',
      'copy-url': 'Copy URL',
      join: 'Join session',
      dismiss: 'Dismiss',
      unparsable: 'This invite URL could not be parsed. Ask the host to resend.',
      'join-failed': 'Could not join the session:',
    },
    remote: {
      'tab-name': 'Shared session',
      'viewing-only': 'Viewing (read-only)',
      driving: 'Driving',
      'waiting-for-frames': 'Waiting for the host\'s first frame…',
      'read-only-hint': 'You are joined as an observer. Press the "Request keyboard" button to take driver control.',
      'driver-hint': 'You hold the keyboard. Your keystrokes execute on the host\'s terminal; press "Release" to hand it back.',
      'request-keyboard': 'Request keyboard',
      'release-keyboard': 'Release keyboard',
      state: {
        pairing: 'Pairing with host…',
        connecting: 'Connecting to relay…',
        connected: 'Connected',
        disconnected: 'Disconnected',
        error: 'Connection error',
      },
    },
  },
};

export default locale;
