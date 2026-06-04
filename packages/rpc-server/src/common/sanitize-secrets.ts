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

import type { IProviderUserConfig } from '@termlnk/agent';
import type { IAIProviderEntity, IHostEntity, IIdentityEntity, ISshKeyEntity } from '@termlnk/database';
import type { ICredential, IProxy, IPublicIdentity, IPublicSshKey } from '@termlnk/terminal';

export interface IPublicCredential {
  type: ICredential['type'];
  username: string;
  hasPassword?: boolean;
  hasPrivateKey?: boolean;
  hasPassphrase?: boolean;
  keyId?: string;
  identityId?: string;
}

export function sanitizeCredential(credential: ICredential | null | undefined): IPublicCredential | null {
  if (!credential) {
    return null;
  }
  switch (credential.type) {
    case 'password':
      return {
        type: 'password',
        username: credential.username,
        hasPassword: !!credential.password,
      };
    case 'rsa':
      return {
        type: 'rsa',
        username: credential.username,
        hasPrivateKey: !!credential.privateKey,
      };
    case 'always':
      return { type: 'always', username: credential.username };
    case 'key':
      return {
        type: 'key',
        username: credential.username,
        keyId: credential.keyId,
        hasPassphrase: !!credential.passphrase,
      };
    case 'identity':
      // Username is resolved from the identity at connect time; not carried on the credential.
      return { type: 'identity', username: '', identityId: credential.identityId };
  }
}

export interface IPublicProxy extends Omit<IProxy, 'password'> {
  hasPassword: boolean;
}

export function sanitizeProxy(proxy: IProxy | null | undefined): IPublicProxy | null {
  if (!proxy) {
    return null;
  }
  const { password, ...rest } = proxy;
  return { ...rest, hasPassword: !!password };
}

type IPublicHostEntity = Omit<IHostEntity, 'credential' | 'proxy'> & {
  credential: IPublicCredential | null;
  proxy: IPublicProxy | null;
};

export function sanitizeHostEntity<T extends IHostEntity>(entity: T): IPublicHostEntity {
  return {
    ...entity,
    credential: sanitizeCredential(entity.credential),
    proxy: sanitizeProxy(entity.proxy),
  };
}

export function sanitizeHostEntities<T extends IHostEntity>(entities: T[]): IPublicHostEntity[] {
  return entities.map((entity) => sanitizeHostEntity(entity));
}

export interface IPublicHostTreeNode extends IPublicHostEntity {
  children: IPublicHostTreeNode[];
}

export function sanitizeHostTree(nodes: Array<IHostEntity & { children: any[] }>): IPublicHostTreeNode[] {
  return nodes.map((node) => ({
    ...sanitizeHostEntity(node),
    children: sanitizeHostTree(node.children ?? []),
  }));
}

// ---------------------------------------------------------------------------
// AI Provider
// ---------------------------------------------------------------------------

type IPublicProviderEntity = Omit<IAIProviderEntity, 'apiKey'> & {
  apiKeyConfigured: boolean;
};

export function sanitizeProviderEntity(entity: IAIProviderEntity): IPublicProviderEntity {
  const { apiKey, ...rest } = entity;
  return { ...rest, apiKeyConfigured: !!apiKey };
}

export function sanitizeProviderEntities(entities: IAIProviderEntity[]): IPublicProviderEntity[] {
  return entities.map(sanitizeProviderEntity);
}

type IPublicProviderUserConfig = Omit<IProviderUserConfig, 'apiKey'> & {
  apiKeyConfigured: boolean;
};

export function sanitizeProviderUserConfig(
  config: IProviderUserConfig | null | undefined
): IPublicProviderUserConfig | null {
  if (!config) {
    return null;
  }
  const { apiKey, ...rest } = config;
  return { ...rest, apiKeyConfigured: !!apiKey };
}

// ---------------------------------------------------------------------------
// Keychain (SSH keys + identities)
// ---------------------------------------------------------------------------

// Projects entities to the single-source public shapes in @termlnk/terminal, dropping the
// private key / passphrase / password and exposing only the hasXxx flags.

export function sanitizeSshKey(entity: ISshKeyEntity): IPublicSshKey {
  return {
    id: entity.id,
    label: entity.label,
    algorithm: entity.algorithm,
    bits: entity.bits,
    publicKey: entity.publicKey,
    certificate: entity.certificate,
    savePassphrase: entity.savePassphrase,
    source: entity.source,
    publicKeyFingerprint: entity.publicKeyFingerprint,
    hasPassphrase: !!entity.passphrase,
  };
}

export function sanitizeSshKeys(entities: ISshKeyEntity[]): IPublicSshKey[] {
  return entities.map(sanitizeSshKey);
}

export function sanitizeIdentity(entity: IIdentityEntity): IPublicIdentity {
  return {
    id: entity.id,
    label: entity.label,
    username: entity.username,
    keyId: entity.keyId,
    hasPassword: !!entity.password,
  };
}

export function sanitizeIdentities(entities: IIdentityEntity[]): IPublicIdentity[] {
  return entities.map(sanitizeIdentity);
}
