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
    tab: {
      label: 'Shared terminal',
      description: 'Inspect shared sessions, create invite links, and control local recordings.',
    },
    panel: {
      title: 'Shared terminal',
      unavailable: 'Shared terminal services are not available in this runtime.',
    },
    invite: {
      create: 'Invite',
      copy: 'Copy link',
    },
    sessions: {
      title: 'Sessions',
      description: 'Active PTY sessions that can be mirrored through invite links.',
      empty: 'No active shared PTY sessions.',
      participants: '{0} participant(s)',
      driver: 'Driver {0}',
    },
    recording: {
      active: 'Recording',
      mandatory: 'Recording (mandatory)',
      'mandatory-hint': 'This recording is mandatory while an auditor is attached. Kick the auditor first to stop.',
      start: 'Record',
      stop: 'Stop',
    },
    'session-state': {
      idle: 'Idle',
      active: 'Active',
      recording: 'Recording',
      closed: 'Closed',
    },
    driver: {
      label: 'Driver: {0}',
      none: 'no driver',
      locked: 'locked',
      typing: 'typing',
      'other-writers': '{0} other writer(s) attached',
      take: 'Take keyboard',
      release: 'Release keyboard',
      lock: 'Lock to me',
      unlock: 'Unlock',
    },
    'recording-policy': {
      title: 'Recording policy',
      description: 'Default behaviour for new collaboration sessions. Auditor attaches always force-enable recording.',
      'default-on': 'Record by default',
      'default-on-hint': 'Every new collaboration session starts recording automatically.',
    },
    'outstanding-invites': {
      title: 'Active invites',
      description: 'Invites that can still be redeemed. Revoke a link to disable future joins.',
      unavailable: 'Invite management is not available in this runtime.',
      empty: 'No active invites.',
    },
    'invite-history': {
      title: 'Invite history',
      description: 'Consumed, revoked, and expired invites.',
      empty: 'No past invites.',
    },
    'invite-row': {
      'single-use': 'single-use',
      session: 'session {0}',
      'expires-at': 'expires {0}',
      'expired-at': 'expired {0}',
      'consumed-at': 'consumed {0}',
      'revoked-at': 'revoked {0}',
      revoke: 'Revoke',
    },
    'invite-status': {
      active: 'active',
      consumed: 'consumed',
      revoked: 'revoked',
      expired: 'expired',
    },
    'invite-role': {
      owner: 'owner',
      'co-pilot': 'co-pilot',
      observer: 'observer',
      auditor: 'auditor',
    },
  },
};

export default locale;
