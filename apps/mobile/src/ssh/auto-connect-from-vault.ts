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

import type { IMobileHostFull } from '../storage/types';

export interface IHostConnectArgs {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
}

// Returns connect args usable as-is, or null when the vault record lacks a
// host address or a complete usable credential. Callers fall back to the
// manual-entry path on null.
export function autoConnectArgsFromVault(host: IMobileHostFull): IHostConnectArgs | null {
  if (!host.addr) {
    return null;
  }
  const cred = host.credential;
  if (!cred) {
    return null;
  }
  const base = { host: host.addr, port: host.port ?? 22, username: cred.username };
  if (cred.type === 'password' && cred.password) {
    return { ...base, password: cred.password };
  }
  if (cred.type === 'rsa' && cred.privateKey) {
    return { ...base, privateKey: cred.privateKey };
  }
  return null;
}
