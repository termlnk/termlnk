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
      start: 'Record',
      stop: 'Stop',
    },
    'session-state': {
      idle: 'Idle',
      active: 'Active',
      recording: 'Recording',
      closed: 'Closed',
    },
  },
};

export default locale;
