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

export type IMobileCredentialType = 'password' | 'rsa' | 'always' | 'key' | 'identity';

export interface IMobilePasswordCredential {
  readonly type: 'password';
  readonly username: string;
  readonly password: string;
}

export interface IMobileRsaCredential {
  readonly type: 'rsa';
  readonly username: string;
  readonly privateKey: string;
}

export interface IMobileAlwaysCredential {
  readonly type: 'always';
  readonly username: string;
}

// References a key in the keychain (ssh_keys table). passphrase overrides the key's own
// stored passphrase for this host only.
export interface IMobileKeyCredential {
  readonly type: 'key';
  readonly username: string;
  readonly keyId: string;
  readonly passphrase?: string;
}

// References a saved identity; username/password/key are resolved from it at connect time.
export interface IMobileIdentityCredential {
  readonly type: 'identity';
  readonly identityId: string;
}

export type IMobileCredential =
  | IMobilePasswordCredential
  | IMobileRsaCredential
  | IMobileAlwaysCredential
  | IMobileKeyCredential
  | IMobileIdentityCredential;

export interface IMobileProxy {
  readonly enabled?: boolean;
  readonly type?: 'socks5' | 'http';
  readonly host?: string;
  readonly port?: number;
  readonly username?: string;
  readonly password?: string;
}

export interface IMobileHostSettings {
  readonly connectTimeout?: number;
  readonly connectHeartbeat?: number;
  readonly encode?: string;
  readonly runScript?: string;
  readonly x11Forward?: boolean;
  readonly termType?: string;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  // Termius-style protocol/keyboard toggles. useSsh gates the SSH path; useMosh
  // and useTelnet are stored but not yet acted on (no Mosh/Telnet transport).
  readonly useSsh?: boolean;
  readonly useMosh?: boolean;
  readonly useTelnet?: boolean;
  // When set, Backspace sends CTRL+H instead of DEL (stored; wiring is future work).
  readonly backspaceAsCtrlH?: boolean;
}

export type IMobileHostType = 'host' | 'group' | 'unknown';

// Public host shape exposed in list streams. Carries `hasCredential` so the UI can
// decide whether to auto-connect or fall back to a manual entry form; the secret
// itself only leaves the repository via `getInfo(id)`.
export interface IMobileHost {
  readonly id: string;
  readonly pid: string;
  readonly label: string;
  readonly type: IMobileHostType;
  readonly addr?: string;
  readonly port?: number;
  readonly sort?: number;
  readonly tree?: string;
  readonly hasCredential: boolean;
}

// Full record returned by repository getInfo(id). The credential / proxy plaintext
// is the only path through which secrets exit the encrypted SQLite store.
export interface IMobileHostFull extends IMobileHost {
  readonly credential?: IMobileCredential | null;
  readonly proxy?: IMobileProxy | null;
  readonly settings?: IMobileHostSettings | null;
  readonly hostChainIds?: readonly string[] | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export type ISshKeyAlgorithm = 'ed25519' | 'ecdsa' | 'rsa';
export type ISshKeySource = 'generated' | 'imported';

// SSH key public view (no private material) for keychain list rendering.
export interface IMobileSshKey {
  readonly id: string;
  readonly label: string;
  readonly algorithm: ISshKeyAlgorithm;
  readonly bits?: number | null;
  readonly publicKey?: string | null;
  readonly certificate?: string | null;
  readonly savePassphrase: boolean;
  readonly source: ISshKeySource;
  readonly publicKeyFingerprint?: string | null;
  readonly hasPassphrase: boolean;
}

// SSH key with secret material; only leaves the repository via getKeyInfo(id).
export interface IMobileSshKeyFull extends IMobileSshKey {
  readonly privateKey: string;
  readonly passphrase?: string | null;
}

// Identity public view; `hasPassword` is a flag, the secret stays in the store.
export interface IMobileIdentity {
  readonly id: string;
  readonly label: string;
  readonly username: string;
  readonly keyId?: string | null;
  readonly hasPassword: boolean;
}

export interface IMobileIdentityFull extends IMobileIdentity {
  readonly password?: string | null;
}

export interface IMobileKnownHost {
  readonly id: string;
  readonly host: string;
  readonly port: number;
  readonly keyType: string;
  readonly fingerprint: string;
  readonly publicKey?: string | null;
  readonly lastSeenAt?: string | null;
}
