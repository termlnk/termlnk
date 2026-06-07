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
import type { IMobileIdentityRepository, IMobileSshKeyRepository } from '../storage/mobile-keychain-repositories';

export interface IHostConnectArgs {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly passphrase?: string;
}

// Returns connect args usable as-is, or null when the vault record lacks a
// host address or a complete usable credential. Callers fall back to the
// manual-entry path on null. Handles only inline credentials (password / rsa);
// `key` / `identity` credentials reference the keychain and need the async
// resolveHostConnectArgs() below.
export function autoConnectArgsFromVault(host: IMobileHostFull): IHostConnectArgs | null {
  if (!host.addr) {
    return null;
  }
  const cred = host.credential;
  if (!cred) {
    return null;
  }
  if (cred.type === 'password' && cred.password) {
    return { host: host.addr, port: host.port ?? 22, username: cred.username, password: cred.password };
  }
  if (cred.type === 'rsa' && cred.privateKey) {
    return { host: host.addr, port: host.port ?? 22, username: cred.username, privateKey: cred.privateKey };
  }
  return null;
}

// Full resolver covering keychain-referencing credentials. `key` pulls the private key (and
// optional passphrase override) from the ssh_keys store; `identity` resolves username +
// password, and a referenced key, from the identities store. Returns null when the chain is
// incomplete so callers fall back to manual entry.
export async function resolveHostConnectArgs(
  host: IMobileHostFull,
  identityRepo: IMobileIdentityRepository,
  keyRepo: IMobileSshKeyRepository
): Promise<IHostConnectArgs | null> {
  if (!host.addr) {
    return null;
  }
  const cred = host.credential;
  if (!cred) {
    return null;
  }
  const port = host.port ?? 22;

  if (cred.type === 'password' || cred.type === 'rsa') {
    return autoConnectArgsFromVault(host);
  }

  if (cred.type === 'key') {
    const key = await keyRepo.getInfo(cred.keyId);
    if (!key?.privateKey) {
      return null;
    }
    return {
      host: host.addr,
      port,
      username: cred.username,
      privateKey: key.privateKey,
      passphrase: cred.passphrase ?? key.passphrase ?? undefined,
    };
  }

  if (cred.type === 'identity') {
    const identity = await identityRepo.getInfo(cred.identityId);
    if (!identity) {
      return null;
    }
    if (identity.keyId) {
      const key = await keyRepo.getInfo(identity.keyId);
      if (key?.privateKey) {
        return {
          host: host.addr,
          port,
          username: identity.username,
          privateKey: key.privateKey,
          passphrase: key.passphrase ?? undefined,
        };
      }
    }
    if (identity.password) {
      return { host: host.addr, port, username: identity.username, password: identity.password };
    }
    return null;
  }

  return null;
}
