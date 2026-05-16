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

// One signed-in device, used by the "account → devices" UI.
//
// `id` is the refresh-token jti (not a secret). The same physical device gets a fresh jti
// on each refresh, but `deviceName` and `createdAt` survive rotation.
export interface IDevice {
  // Server-side jti; suitable React key and revoke target.
  readonly id: string;
  // Reported by the client at login (defaults to os.hostname()); null on legacy clients.
  readonly deviceName: string | null;
  // Coarse fingerprint; null when not provided.
  readonly userAgent: string | null;
  readonly createdAt: string;
  // Used to sort the device list.
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  // Marks the device that issued the current request, so the UI can highlight "This device".
  readonly isCurrent: boolean;
}
