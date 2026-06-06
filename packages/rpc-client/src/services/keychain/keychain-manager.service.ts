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

import type { IIdentityChangeEvent, IKnownHost, IKnownHostChangeEvent, IPublicIdentity, IPublicSshKey, ISshKeyChangeEvent, SshKeyAlgorithm, SshKeyCipher } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface IGenerateKeyInput {
  label: string;
  algorithm: SshKeyAlgorithm;
  bits?: number;
  passphrase?: string;
  savePassphrase?: boolean;
  cipher?: SshKeyCipher;
  rounds?: number;
}

export interface IImportKeyInput {
  label: string;
  privateKey: string;
  passphrase?: string;
  savePassphrase?: boolean;
  certificate?: string;
}

export interface IUpdateKeyInput {
  id: string;
  label?: string;
  publicKey?: string;
  privateKey?: string;
  certificate?: string;
  passphrase?: string;
  savePassphrase?: boolean;
}

export interface ICreateIdentityInput {
  label: string;
  username: string;
  password?: string;
  keyId?: string;
}

export interface IUpdateIdentityInput {
  id: string;
  label?: string;
  username?: string;
  password?: string;
  keyId?: string | null;
}

export interface IKeychainReferrers {
  hosts: Array<{ id: string; label: string }>;
  identities: Array<{ id: string; label: string }>;
}

export interface IKeychainManagerService {
  listKeys(): Promise<IPublicSshKey[]>;
  getKey(id: string): Promise<IPublicSshKey | undefined>;
  /** Decrypted private-key PEM for inspection/copy (explicit reveal only). */
  revealPrivateKey(id: string): Promise<string | undefined>;
  generateKey(input: IGenerateKeyInput): Promise<string>;
  importKey(input: IImportKeyInput): Promise<string>;
  updateKey(input: IUpdateKeyInput): Promise<void>;
  getKeyReferrers(id: string): Promise<IKeychainReferrers>;
  deleteKey(id: string): Promise<void>;
  onKeysChanged$(): Observable<ISshKeyChangeEvent>;

  listIdentities(): Promise<IPublicIdentity[]>;
  getIdentity(id: string): Promise<IPublicIdentity | undefined>;
  /** Decrypted password for editing (explicit reveal only). */
  revealPassword(id: string): Promise<string | undefined>;
  createIdentity(input: ICreateIdentityInput): Promise<string>;
  updateIdentity(input: IUpdateIdentityInput): Promise<void>;
  getIdentityReferrers(id: string): Promise<{ hosts: Array<{ id: string; label: string }> }>;
  deleteIdentity(id: string): Promise<void>;
  onIdentitiesChanged$(): Observable<IIdentityChangeEvent>;

  listKnownHosts(): Promise<IKnownHost[]>;
  deleteKnownHost(id: string): Promise<void>;
  deleteKnownHosts(ids: string[]): Promise<void>;
  onKnownHostsChanged$(): Observable<IKnownHostChangeEvent>;
}

export const IKeychainManagerService = createIdentifier<IKeychainManagerService>('rpc-client.keychain-manager-service');

export class KeychainManagerService extends Disposable implements IKeychainManagerService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  listKeys(): Promise<IPublicSshKey[]> {
    return this._client().listKeys.query();
  }

  getKey(id: string): Promise<IPublicSshKey | undefined> {
    return this._client().getKey.query(id);
  }

  revealPrivateKey(id: string): Promise<string | undefined> {
    return this._client().revealPrivateKey.query(id);
  }

  generateKey(input: IGenerateKeyInput): Promise<string> {
    return this._client().generateKey.mutate(input);
  }

  importKey(input: IImportKeyInput): Promise<string> {
    return this._client().importKey.mutate(input);
  }

  updateKey(input: IUpdateKeyInput): Promise<void> {
    return this._client().updateKey.mutate(input);
  }

  getKeyReferrers(id: string): Promise<IKeychainReferrers> {
    return this._client().getKeyReferrers.query(id);
  }

  deleteKey(id: string): Promise<void> {
    return this._client().deleteKey.mutate(id);
  }

  onKeysChanged$(): Observable<ISshKeyChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client().onKeysChanged$.subscribe(undefined, opts));
  }

  listIdentities(): Promise<IPublicIdentity[]> {
    return this._client().listIdentities.query();
  }

  getIdentity(id: string): Promise<IPublicIdentity | undefined> {
    return this._client().getIdentity.query(id);
  }

  revealPassword(id: string): Promise<string | undefined> {
    return this._client().revealPassword.query(id);
  }

  createIdentity(input: ICreateIdentityInput): Promise<string> {
    return this._client().createIdentity.mutate(input);
  }

  updateIdentity(input: IUpdateIdentityInput): Promise<void> {
    return this._client().updateIdentity.mutate(input);
  }

  getIdentityReferrers(id: string): Promise<{ hosts: Array<{ id: string; label: string }> }> {
    return this._client().getIdentityReferrers.query(id);
  }

  deleteIdentity(id: string): Promise<void> {
    return this._client().deleteIdentity.mutate(id);
  }

  onIdentitiesChanged$(): Observable<IIdentityChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client().onIdentitiesChanged$.subscribe(undefined, opts));
  }

  listKnownHosts(): Promise<IKnownHost[]> {
    return this._client().listKnownHosts.query();
  }

  deleteKnownHost(id: string): Promise<void> {
    return this._client().deleteKnownHost.mutate(id);
  }

  deleteKnownHosts(ids: string[]): Promise<void> {
    return this._client().deleteKnownHosts.mutate(ids);
  }

  onKnownHostsChanged$(): Observable<IKnownHostChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client().onKnownHostsChanged$.subscribe(undefined, opts));
  }

  private _client() {
    return this._rpcClientService.getClient().keychain;
  }
}
