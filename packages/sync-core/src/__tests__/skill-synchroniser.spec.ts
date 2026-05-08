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
import type { ISkillEntity, ISkillEntityInsert, SkillRepository, SyncRowMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem, ISyncRowMetaEntity, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkillSynchroniser } from '../synchronisers/skill-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeSkillRepository {
  rows: Map<string, ISkillEntity> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete'; id: string }> = new Subject();

  async getAll(): Promise<ISkillEntity[]> {
    return [...this.rows.values()];
  }

  async getById(id: string): Promise<ISkillEntity | undefined> {
    return this.rows.get(id);
  }

  async upsert(record: ISkillEntityInsert): Promise<string> {
    this.rows.set(record.id, record as ISkillEntity);
    this.changed$.next({ type: 'update', id: record.id });
    return record.id;
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
    return [...this.rows.values()].filter((r) => r.resource === resource);
  }

  async upsert(meta: ISyncRowMetaEntity): Promise<void> {
    this.rows.set(this._key(meta.resource, meta.entityId), meta);
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    this.rows.delete(this._key(resource, entityId));
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    for (const k of [...this.rows.keys()]) {
      if (this.rows.get(k)?.resource === resource) {
        this.rows.delete(k);
      }
    }
  }
}

class FakeOutbox implements ISyncOutboxService {
  enqueued: Array<Omit<ISyncMutation, 'id' | 'createdAt'>> = [];
  pendingCount$ = new Subject<number>();
  private _idCounter = 0;

  async enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation> {
    this.enqueued.push(mutation);
    return {
      ...mutation,
      id: ++this._idCounter,
      createdAt: Date.now(),
    } as ISyncMutation;
  }

  async peek(): Promise<ISyncMutation[]> {
    return [];
  }

  async ack(): Promise<void> {}

  async markRejected(): Promise<void> {}

  async countByResource(): Promise<number> {
    return 0;
  }

  async clearResource(): Promise<void> {}
}

class FakeCrypto implements ISyncCryptoService {
  available = true;

  encrypt(plaintext: Uint8Array): Uint8Array {
    // Simple obfuscation prefix so the test can recover the original
    const prefix = new TextEncoder().encode('FAKE_E:');
    const out = new Uint8Array(prefix.length + plaintext.length);
    out.set(prefix, 0);
    out.set(plaintext, prefix.length);
    return out;
  }

  decrypt(ciphertext: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode('FAKE_E:');
    if (ciphertext.length < prefix.length) {
      throw new Error('FakeCrypto: too short');
    }
    return ciphertext.subarray(prefix.length);
  }

  hmacIndex(value: string): Uint8Array {
    return new TextEncoder().encode(`HMAC:${value}`);
  }
}

function makeSkill(id: string, overrides: Partial<ISkillEntity> = {}): ISkillEntity {
  return {
    id,
    name: 'demo',
    path: '/local/path/x.md',
    source: 'user' as never,
    registryId: null,
    version: '1.0.0',
    enabled: true,
    sortOrder: 0,
    checksum: 'abc123',
    accessedAt: '2026-05-09T00:00:00.000Z',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

interface ITestBed {
  skillRepo: FakeSkillRepository;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: SkillSynchroniser;
}

function createTestBed(): ITestBed {
  const skillRepo = new FakeSkillRepository();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new SkillSynchroniser(
    skillRepo as unknown as SkillRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { skillRepo, rowMeta, outbox, crypto, syncer };
}

describe('SkillSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "skill" and starts in Idle state', async () => {
    expect(bed.syncer.resourceId).toBe('skill');
    const status = await firstValue(bed.syncer.status$);
    expect(status).toBe('idle');
  });

  it('start subscribes only once — repeated start() is a no-op', async () => {
    bed.syncer.start();
    bed.syncer.start();
    bed.syncer.start();

    bed.skillRepo.rows.set('s1', makeSkill('s1'));
    bed.skillRepo.changed$.next({ type: 'add', id: 's1' });

    await flushAsync();
    expect(bed.outbox.enqueued.length).toBe(1);
  });

  it('local update enqueues an upsert mutation with encrypted full row', async () => {
    bed.syncer.start();
    const skill = makeSkill('s1', { name: 'updated' });
    bed.skillRepo.rows.set('s1', skill);
    bed.skillRepo.changed$.next({ type: 'update', id: 's1' });

    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    const mut = bed.outbox.enqueued[0];
    expect(mut.resource).toBe('skill');
    expect(mut.op).toBe('upsert');
    expect(mut.entityId).toBe('s1');
    expect(mut.baseVersion).toBeNull();

    // Recover the encrypted body and verify it round-trips through the fake crypto
    const json = bed.crypto.decrypt(mut.payload!);
    const recovered = JSON.parse(new TextDecoder().decode(json));
    expect(recovered.id).toBe('s1');
    expect(recovered.name).toBe('updated');
  });

  it('local delete enqueues a delete mutation with null payload', async () => {
    bed.syncer.start();
    bed.skillRepo.changed$.next({ type: 'delete', id: 's1' });

    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0]).toMatchObject({
      op: 'delete',
      entityId: 's1',
      payload: null,
      baseVersion: null,
    });
  });

  it('local update with prior sync_row_meta uses its version as baseVersion', async () => {
    bed.syncer.start();
    await bed.rowMeta.upsert({
      resource: 'skill',
      entityId: 's1',
      version: 42,
      updatedAt: Date.now(),
    });
    bed.skillRepo.rows.set('s1', makeSkill('s1'));
    bed.skillRepo.changed$.next({ type: 'update', id: 's1' });

    await flushAsync();
    expect(bed.outbox.enqueued[0].baseVersion).toBe(42);
  });

  it('changed$ events emitted while applyPatch is running are NOT pushed back to outbox', async () => {
    bed.syncer.start();

    const skill = makeSkill('s1', { name: 'remote-version' });
    const json = JSON.stringify(skill);
    const patchItem: ISyncPatchItem = {
      op: 'put',
      resource: 'skill',
      entityId: 's1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(json)),
      version: 7,
    };

    await bed.syncer.applyPatch([patchItem]);
    await flushAsync();

    // The applyPatch upserted the row, which fired changed$. That event must NOT have caused outbox.enqueue.
    expect(bed.outbox.enqueued).toHaveLength(0);

    // The row was applied + sync_row_meta was bumped to version 7
    expect(bed.skillRepo.rows.get('s1')?.name).toBe('remote-version');
    expect((await bed.rowMeta.get('skill', 's1'))?.version).toBe(7);
  });

  it('applyPatch op=del removes the row and its row meta', async () => {
    bed.syncer.start();
    bed.skillRepo.rows.set('s1', makeSkill('s1'));
    await bed.rowMeta.upsert({
      resource: 'skill',
      entityId: 's1',
      version: 3,
      updatedAt: Date.now(),
    });

    await bed.syncer.applyPatch([{
      op: 'del',
      resource: 'skill',
      entityId: 's1',
      payload: null,
      version: 4,
    }]);

    expect(bed.skillRepo.rows.has('s1')).toBe(false);
    expect(await bed.rowMeta.get('skill', 's1')).toBeNull();
  });

  it('applyPatch ignores patch items for other resources', async () => {
    bed.syncer.start();
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'host' as SyncResourceId,
      entityId: 'h1',
      payload: new Uint8Array(0),
      version: 1,
    }]);
    expect(bed.skillRepo.rows.size).toBe(0);
  });

  it('buildInitialSnapshot enqueues one upsert per existing row', async () => {
    bed.skillRepo.rows.set('s1', makeSkill('s1'));
    bed.skillRepo.rows.set('s2', makeSkill('s2', { name: 'second' }));

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(2);
    expect(snapshot.every((m) => m.op === 'upsert')).toBe(true);
    expect(bed.outbox.enqueued).toHaveLength(2);
  });

  it('races: row deleted between event and getById → emits delete mutation instead of crashing', async () => {
    bed.syncer.start();
    // event for s1 but s1 not present
    bed.skillRepo.changed$.next({ type: 'update', id: 's1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].op).toBe('delete');
  });

  it('dispose unsubscribes from changed$ — subsequent events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();

    bed.skillRepo.rows.set('s1', makeSkill('s1'));
    bed.skillRepo.changed$.next({ type: 'add', id: 's1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});

async function firstValue<T>(observable: { subscribe: (handler: (v: T) => void) => { unsubscribe: () => void } }): Promise<T> {
  return new Promise((resolve) => {
    const sub = observable.subscribe((v) => {
      resolve(v);
      queueMicrotask(() => sub.unsubscribe());
    });
  });
}

async function flushAsync(): Promise<void> {
  // Multiple microtask flushes — rxjs subscribe + async handler chains
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
