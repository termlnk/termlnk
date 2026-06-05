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

import type { ILogService, LogLevel } from '@termlnk/core';
import type { IdentityRepository, IIdentityEntity, ISyncRowMetaEntity, SyncRowMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IdentitySynchroniser } from '../synchronisers/identity-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeIdentityRepo {
  rows: Map<string, IIdentityEntity> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete'; id: string }> = new Subject();

  async getList(): Promise<IIdentityEntity[]> {
    return [...this.rows.values()];
  }

  async getById(id: string): Promise<IIdentityEntity | undefined> {
    return this.rows.get(id);
  }

  async syncUpsertRow(entity: IIdentityEntity): Promise<void> {
    const existed = this.rows.has(entity.id);
    this.rows.set(entity.id, entity);
    this.changed$.next({ type: existed ? 'update' : 'add', id: entity.id });
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
    this.changed$.next({ type: 'delete', id });
  }
}

class FakeRowMetaRepo {
  rows: Map<string, ISyncRowMetaEntity> = new Map();

  private _key(resource: SyncResourceId, entityId: string): string {
    return `${resource}::${entityId}`;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMetaEntity | null> {
    return this.rows.get(this._key(resource, entityId)) ?? null;
  }

  async getAll(resource: SyncResourceId): Promise<ISyncRowMetaEntity[]> {
    return [...this.rows.values()].filter((m) => m.resource === resource);
  }

  async upsert(meta: ISyncRowMetaEntity): Promise<void> {
    this.rows.set(this._key(meta.resource, meta.entityId), meta);
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    this.rows.delete(this._key(resource, entityId));
  }
}

class FakeOutbox implements ISyncOutboxService {
  enqueued: Array<Omit<ISyncMutation, 'id' | 'createdAt'>> = [];
  pendingCount$ = new Subject<number>();
  private _idCounter = 0;

  async enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation> {
    this.enqueued.push(mutation);
    return { ...mutation, id: ++this._idCounter, createdAt: Date.now() } as ISyncMutation;
  }

  async peek(): Promise<ISyncMutation[]> { return []; }
  async ack(): Promise<void> {}
  async markRejected(): Promise<void> {}
  async countByResource(): Promise<number> { return 0; }
  async clearResource(): Promise<void> {}
  async purgeByEntityIdPrefixes(): Promise<number> { return 0; }
}

class FakeCrypto implements ISyncCryptoService {
  available = true;

  encrypt(plaintext: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode('FAKE_E:');
    const out = new Uint8Array(prefix.length + plaintext.length);
    out.set(prefix, 0);
    out.set(plaintext, prefix.length);
    return out;
  }

  decrypt(ciphertext: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode('FAKE_E:');
    return ciphertext.subarray(prefix.length);
  }

  hmacIndex(value: string): Uint8Array {
    return new TextEncoder().encode(`HMAC:${value}`);
  }
}

function makeIdentity(id: string, overrides: Partial<IIdentityEntity> = {}): IIdentityEntity {
  return {
    id,
    label: 'demo-identity',
    username: 'root',
    password: 'secret-pw',
    keyId: null,
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  } as IIdentityEntity;
}

interface ITestBed {
  repo: FakeIdentityRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: IdentitySynchroniser;
}

function createTestBed(): ITestBed {
  const repo = new FakeIdentityRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new IdentitySynchroniser(
    repo as unknown as IdentityRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { repo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('IdentitySynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "identity"', () => {
    expect(bed.syncer.resourceId).toBe('identity');
  });

  it('local add enqueues an upsert mutation with encrypted full row', async () => {
    bed.syncer.start();
    bed.repo.rows.set('i1', makeIdentity('i1', { username: 'admin' }));
    bed.repo.changed$.next({ type: 'add', id: 'i1' });

    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('i1');
    expect(bed.outbox.enqueued[0].op).toBe('upsert');
  });

  it('local delete enqueues a delete mutation with null payload', async () => {
    bed.syncer.start();
    bed.repo.changed$.next({ type: 'delete', id: 'i1' });

    await flushAsync();

    expect(bed.outbox.enqueued[0]).toMatchObject({
      op: 'delete',
      entityId: 'i1',
      payload: null,
    });
  });

  it('applyPatch op=put creates a row that did not exist locally', async () => {
    bed.syncer.start();
    const row = makeIdentity('i1', { username: 'remote-create' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'identity',
      entityId: 'i1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 5,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.repo.rows.get('i1')?.username).toBe('remote-create');
    expect((await bed.rowMeta.get('identity', 'i1'))?.version).toBe(5);
  });

  it('applyPatch op=put updates an existing row in place', async () => {
    bed.syncer.start();
    bed.repo.rows.set('i1', makeIdentity('i1', { username: 'original' }));
    const updated = makeIdentity('i1', { username: 'rotated' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'identity',
      entityId: 'i1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(updated))),
      version: 6,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.repo.rows.get('i1')?.username).toBe('rotated');
  });

  it('applyPatch op=del removes the row and its row meta', async () => {
    bed.syncer.start();
    bed.repo.rows.set('i1', makeIdentity('i1'));
    await bed.rowMeta.upsert({ resource: 'identity', entityId: 'i1', version: 1, updatedAt: Date.now() });

    await bed.syncer.applyPatch([{ op: 'del', resource: 'identity', entityId: 'i1', payload: null, version: 2 }]);

    expect(bed.repo.rows.has('i1')).toBe(false);
    expect(await bed.rowMeta.get('identity', 'i1')).toBeNull();
  });

  it('changed$ events emitted while applyPatch is running do NOT fan back to outbox', async () => {
    bed.syncer.start();
    const row = makeIdentity('i1', { username: 'remote' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'identity',
      entityId: 'i1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 7,
    };

    await bed.syncer.applyPatch([patch]);
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot enqueues one upsert per existing row', async () => {
    bed.repo.rows.set('i1', makeIdentity('i1'));
    bed.repo.rows.set('i2', makeIdentity('i2'));

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(2);
    expect(bed.outbox.enqueued).toHaveLength(2);
  });

  it('buildInitialSnapshot skips rows that already have a sync_row_meta entry', async () => {
    bed.repo.rows.set('i1', makeIdentity('i1'));
    bed.repo.rows.set('i2', makeIdentity('i2'));
    await bed.rowMeta.upsert({ resource: 'identity', entityId: 'i1', version: 7, updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(1);
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('i2');
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();

    bed.repo.changed$.next({ type: 'add', id: 'i1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
