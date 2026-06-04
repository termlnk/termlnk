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

import type { IdentityRepository, SshKeyRepository } from '@termlnk/database';
import type { IAlwaysCredential, ICredential, IPasswordCredential, IRSACredential } from '@termlnk/terminal';

// A credential the ssh2 ConnectConfig can consume directly. Keychain references (key /
// identity) are resolved down to one of these before a connection is built.
export type IResolvedCredential = IPasswordCredential | IRSACredential | IAlwaysCredential;

export interface IResolveHostCredentialDeps {
  sshKeyRepo: SshKeyRepository;
  identityRepo: IdentityRepository;
}

export interface IResolvedAuth {
  credential: IResolvedCredential;
  /** Private-key passphrase, when the resolved key is encrypted. */
  passphrase?: string;
}

// Resolves keychain references into an inline credential. Mirrors Netcatty's resolveHostAuth
// precedence: a key reference becomes rsa auth; an identity becomes its key (rsa) when it has
// one, otherwise password auth carrying the identity's username. Legacy password / rsa / always
// credentials pass through untouched so existing hosts keep working.
export async function resolveHostCredential(
  credential: ICredential,
  deps: IResolveHostCredentialDeps
): Promise<IResolvedAuth> {
  switch (credential.type) {
    case 'password':
    case 'rsa':
    case 'always':
      return { credential };
    case 'key': {
      const key = await deps.sshKeyRepo.getById(credential.keyId);
      if (!key) {
        throw new Error(`[resolveHostCredential] SSH key ${credential.keyId} not found`);
      }
      return {
        credential: { type: 'rsa', username: credential.username, privateKey: key.privateKey },
        passphrase: credential.passphrase || key.passphrase || undefined,
      };
    }
    case 'identity': {
      const identity = await deps.identityRepo.getById(credential.identityId);
      if (!identity) {
        throw new Error(`[resolveHostCredential] Identity ${credential.identityId} not found`);
      }
      if (identity.keyId) {
        const key = await deps.sshKeyRepo.getById(identity.keyId);
        if (!key) {
          throw new Error(`[resolveHostCredential] Identity ${identity.id} references missing key ${identity.keyId}`);
        }
        return {
          credential: { type: 'rsa', username: identity.username, privateKey: key.privateKey },
          passphrase: key.passphrase || undefined,
        };
      }
      // No key: password auth. An empty password lets createConnectConfig's override (a typed
      // retry password) fill it, otherwise the server falls back to keyboard-interactive.
      return {
        credential: { type: 'password', username: identity.username, password: identity.password ?? '' },
      };
    }
  }
}
