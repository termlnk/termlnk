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

export type IMobileCredentialType = 'password' | 'rsa' | 'always';

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

export type IMobileCredential =
  | IMobilePasswordCredential
  | IMobileRsaCredential
  | IMobileAlwaysCredential;

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
