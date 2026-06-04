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

import type { IIdentityEntity, ISshKeyEntity } from '@termlnk/database';
import type { ICredential } from '@termlnk/terminal';
import type { IResolveHostCredentialDeps } from './resolve-host-credential';
import { describe, expect, it } from 'vitest';
import { resolveHostCredential } from './resolve-host-credential';

function makeDeps(keys: Partial<ISshKeyEntity>[], identities: Partial<IIdentityEntity>[]): IResolveHostCredentialDeps {
  return {
    sshKeyRepo: {
      getById: async (id: string) => keys.find((k) => k.id === id),
    } as unknown as IResolveHostCredentialDeps['sshKeyRepo'],
    identityRepo: {
      getById: async (id: string) => identities.find((i) => i.id === id),
    } as unknown as IResolveHostCredentialDeps['identityRepo'],
  };
}

describe('resolveHostCredential', () => {
  it('passes legacy password / rsa / always credentials through unchanged', async () => {
    const deps = makeDeps([], []);
    const password: ICredential = { type: 'password', username: 'root', password: 'pw' };
    const rsa: ICredential = { type: 'rsa', username: 'root', privateKey: 'PK' };
    const always: ICredential = { type: 'always', username: 'root' };

    expect((await resolveHostCredential(password, deps)).credential).toEqual(password);
    expect((await resolveHostCredential(rsa, deps)).credential).toEqual(rsa);
    expect((await resolveHostCredential(always, deps)).credential).toEqual(always);
  });

  it('resolves a key credential into rsa auth with the key private key and passphrase', async () => {
    const deps = makeDeps([{ id: 'k1', privateKey: 'PRIV', passphrase: 'phrase' }], []);
    const resolved = await resolveHostCredential({ type: 'key', username: 'deploy', keyId: 'k1' }, deps);
    expect(resolved.credential).toEqual({ type: 'rsa', username: 'deploy', privateKey: 'PRIV' });
    expect(resolved.passphrase).toBe('phrase');
  });

  it('prefers a per-host passphrase over the key passphrase', async () => {
    const deps = makeDeps([{ id: 'k1', privateKey: 'PRIV', passphrase: 'keyphrase' }], []);
    const resolved = await resolveHostCredential(
      { type: 'key', username: 'deploy', keyId: 'k1', passphrase: 'hostphrase' },
      deps
    );
    expect(resolved.passphrase).toBe('hostphrase');
  });

  it('resolves an identity with a key into rsa auth using the identity username', async () => {
    const deps = makeDeps([{ id: 'k1', privateKey: 'PRIV' }], [{ id: 'i1', username: 'alice', keyId: 'k1' }]);
    const resolved = await resolveHostCredential({ type: 'identity', identityId: 'i1' }, deps);
    expect(resolved.credential).toEqual({ type: 'rsa', username: 'alice', privateKey: 'PRIV' });
  });

  it('resolves an identity without a key into password auth', async () => {
    const deps = makeDeps([], [{ id: 'i1', username: 'bob', password: 'secret' }]);
    const resolved = await resolveHostCredential({ type: 'identity', identityId: 'i1' }, deps);
    expect(resolved.credential).toEqual({ type: 'password', username: 'bob', password: 'secret' });
  });

  it('throws when a referenced key is missing', async () => {
    const deps = makeDeps([], []);
    await expect(resolveHostCredential({ type: 'key', username: 'x', keyId: 'gone' }, deps)).rejects.toThrow();
  });
});
