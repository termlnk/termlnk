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
import type { HostRepository, IHostEntity, ISyncRowMetaEntity, SyncRowMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostSynchroniser } from '../synchronisers/host-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeHostRepo {
  rows: Map<string, IHostEntity> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete' | 'move'; id: string; pid: string }> = new Subject();

  async getInfoById(id: string): Promise<IHostEntity | undefined> {
    return this.rows.get(id);
  }

  async getTree(): Promise<Array<{ id: string; pid: string; children: Array<{ id: string; pid: string; children: unknown[] }> }>> {
    // Group rows by pid; for tests we just emit a flat list under root
    const roots = [...this.rows.values()].filter((r) => r.pid === 'root');
    return roots.map((r) => ({ id: r.id, pid: r.pid, children: [] }));
  }

  async syncUpsertRow(entity: IHostEntity): Promise<void> {
    this.rows.set(entity.id, entity);
    this.changed$.next({ type: 'update', id: entity.id, pid: entity.pid });
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
    this.changed$.next({ type: 'delete', id, pid: '' });
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
    return { ...mutation, id: ++this._idCounter, createdAt: Date.now() } as ISyncMutation;
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
    const prefix = new TextEncoder().encode('FAKE_E:');
    const out = new Uint8Array(prefix.length + plaintext.length);
    out.set(prefix, 0);
    out.set(plaintext, prefix.length);
    return out;
  }

  decrypt(ciphertext: Uint8Array): Uint8Array {
    return ciphertext.subarray('FAKE_E:'.length);
  }

  hmacIndex(value: string): Uint8Array {
    return new TextEncoder().encode(`HMAC:${value}`);
  }
}

function makeHost(id: string, overrides: Partial<IHostEntity> = {}): IHostEntity {
  return {
    id,
    label: 'demo',
    type: 'host' as never,
    pid: 'root',
    tree: `root_${id}`,
    addr: '10.0.0.1',
    port: 22,
    credential: { type: 'password', username: 'admin', password: 'secret' } as never,
    proxy: null,
    settings: null,
    hostChainIds: null,
    sort: 0,
    expanded: false,
    accessedAt: '2026-05-09',
    createdAt: '2026-05-09',
    updatedAt: '2026-05-09',
    ...overrides,
  };
}

interface ITestBed {
  hostRepo: FakeHostRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: HostSynchroniser;
}

function createTestBed(): ITestBed {
  const hostRepo = new FakeHostRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new HostSynchroniser(
    hostRepo as unknown as HostRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { hostRepo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('HostSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "host"', () => {
    expect(bed.syncer.resourceId).toBe('host');
  });

  it('local update enqueues an upsert with full row including credential', async () => {
    bed.syncer.start();
    const host = makeHost('h1', { label: 'updated' });
    bed.hostRepo.rows.set('h1', host);
    bed.hostRepo.changed$.next({ type: 'update', id: 'h1', pid: 'root' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    const mut = bed.outbox.enqueued[0];
    expect(mut.entityId).toBe('h1');
    expect(mut.op).toBe('upsert');

    const recovered = JSON.parse(new TextDecoder().decode(bed.crypto.decrypt(mut.payload!)));
    expect(recovered.credential).toEqual({ type: 'password', username: 'admin', password: 'secret' });
  });

  it("'move' events are treated as updates and pushed", async () => {
    bed.syncer.start();
    bed.hostRepo.rows.set('h1', makeHost('h1', { pid: 'g1', tree: 'root_g1_h1' }));
    bed.hostRepo.changed$.next({ type: 'move', id: 'h1', pid: 'g1' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].op).toBe('upsert');

    const recovered = JSON.parse(new TextDecoder().decode(bed.crypto.decrypt(bed.outbox.enqueued[0].payload!)));
    expect(recovered.pid).toBe('g1');
    expect(recovered.tree).toBe('root_g1_h1');
  });

  it('local delete enqueues a delete mutation', async () => {
    bed.syncer.start();
    bed.hostRepo.changed$.next({ type: 'delete', id: 'h1', pid: 'root' });

    await flushAsync();
    expect(bed.outbox.enqueued[0]).toMatchObject({
      op: 'delete',
      entityId: 'h1',
      payload: null,
    });
  });

  it('applyPatch op=put writes the full row through HostRepository.syncUpsertRow', async () => {
    bed.syncer.start();
    const remote = makeHost('h1', { label: 'remote' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'host',
      entityId: 'h1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(remote))),
      version: 5,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.hostRepo.rows.get('h1')?.label).toBe('remote');
    expect((await bed.rowMeta.get('host', 'h1'))?.version).toBe(5);
  });

  it('applyPatch op=del calls HostRepository.delete (which cascades) and clears row meta', async () => {
    bed.syncer.start();
    bed.hostRepo.rows.set('h1', makeHost('h1'));
    await bed.rowMeta.upsert({ resource: 'host', entityId: 'h1', version: 3, updatedAt: Date.now() });

    await bed.syncer.applyPatch([{ op: 'del', resource: 'host', entityId: 'h1', payload: null, version: 4 }]);

    expect(bed.hostRepo.rows.has('h1')).toBe(false);
    expect(await bed.rowMeta.get('host', 'h1')).toBeNull();
  });

  it('changed$ events fired during applyPatch are NOT pushed back to outbox', async () => {
    bed.syncer.start();
    const remote = makeHost('h1', { label: 'remote' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'host',
      entityId: 'h1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(remote))),
      version: 7,
    };

    await bed.syncer.applyPatch([patch]);
    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot enumerates the tree and enqueues one upsert per host', async () => {
    bed.hostRepo.rows.set('h1', makeHost('h1'));
    bed.hostRepo.rows.set('h2', makeHost('h2'));

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(2);
    expect(bed.outbox.enqueued).toHaveLength(2);
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();
    bed.hostRepo.changed$.next({ type: 'add', id: 'h1', pid: 'root' });
    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
