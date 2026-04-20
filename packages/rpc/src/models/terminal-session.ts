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

export interface ITerminalSessionCreatedEvent {
  sessionId: string;
  type: 'ssh' | 'local';
  hostId?: string;
  hostLabel?: string;
}

export interface ITerminalSessionClosedEvent {
  sessionId: string;
  /** Set when session closed due to an error (auth failure, network error, etc.). Absent for normal close. */
  reason?: 'auth_failed' | 'error';
}

export interface ITerminalSessionStatusChangedEvent {
  sessionId: string;
  status: string;
}
