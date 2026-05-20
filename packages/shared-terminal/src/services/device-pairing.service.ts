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

import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

/** Same-account shared session as advertised by another device. */
export interface IRemoteAnnouncedSession {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly title: string;
  readonly cols: number;
  readonly rows: number;
  readonly announcedAt: number;
}

/**
 * Same-account multi-device discovery.
 *
 * Each signed-in device pushes its active shared session metadata to the cloud
 * (`POST /v1/multiplayer/announce`) and polls (`GET /v1/multiplayer/sessions`)
 * for sessions advertised by the user's other devices. Joining an announced
 * session is a one-click flow that bypasses the cross-account invite URL path
 * (the trust assumption is "same account = same person").
 *
 * Contract lives in @termlnk/shared-terminal so the implementation (rpc-server)
 * and renderer facade (rpc-client) share types without a circular dep.
 */
export interface IDevicePairingService {
  readonly remoteSessions$: Observable<readonly IRemoteAnnouncedSession[]>;
  list(): Promise<readonly IRemoteAnnouncedSession[]>;

  /** Push the local active session into the cloud index. */
  announceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void>;

  /** Tell the cloud index this device no longer hosts the session. */
  retractSession(sessionId: string): Promise<void>;

  /** Force a fresh GET against the index. UI calls this on settings open. */
  refresh(): Promise<void>;
}

export const IDevicePairingService = createIdentifier<IDevicePairingService>(
  'shared-terminal.device-pairing-service'
);
