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
import type {
  ISnippetSyncRepository,
  ISyncCryptoService,
  ISyncEntityRow,
  ISyncMutation,
  ISyncOutboxService,
  ISyncPatchItem,
  ISyncRowMeta,
  ISyncRowMetaRepository,
  SyncResourceId,
} from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SnippetSynchroniser } from '../synchronisers/snippet-synchroniser';

// Snippet has no concrete DB entity yet (the per-platform repositories land in the desktop /
// mobile implementation sub-tasks), so these tests exercise the synchroniser purely against
// the @termlnk/sync contract — exactly the surface the engine relies on.
interface ISnippetRow extends ISyncEntityRow {
  name: string;
  command: string;
  description?: string;
}

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeSnippetRepo implements ISnippetSyncRepository {
  rows: Map<string, ISnippetRow> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete'; id: string }> = new Subject();

  async getList(): Promise<ISnippetRow[]> {
    return [...this.rows.values()];
  }

  async getById(id: string): Promise<ISnippetRow | undefined> {
    return this.rows.get(id);
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const existed = this.rows.has(entity.id);
    this.rows.set(entity.id, entity as ISnippetRow);
    this.changed$.next({ type: existed ? 'update' : 'add', id: entity.id });
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
    this.changed$.next({ type: 'delete', id });
  }
}

class FakeRowMetaRepo implements ISyncRowMetaRepository {
  rows: Map<string, ISyncRowMeta> = new Map();

  private _key(resource: SyncResourceId, entityId: string): string {
    return `${resource}::${entityId}`;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMeta | null> {
    return this.rows.get(this._key(resource, entityId)) ?? null;
  }

  async getAll(resource: SyncResourceId): Promise<ISyncRowMeta[]> {
    return [...this.rows.values()].filter((m) => m.resource === resource);
  }

  async upsert(meta: ISyncRowMeta): Promise<void> {
    this.rows.set(this._key(meta.resource, meta.entityId), meta);
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    this.rows.delete(this._key(resource, entityId));
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    for (const [key, meta] of [...this.rows.entries()]) {
      if (meta.resource === resource) {
        this.rows.delete(key);
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

  async peek(): Promise<ISyncMutation[]> { return []; }
  async ack(): Promise<void> {}
  async markRejected(): Promise<Map<number, number>> { return new Map(); }
  async updateBaseVersion(): Promise<void> {}
  async discard(): Promise<void> {}
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

function makeSnippet(id: string, overrides: Partial<ISnippetRow> = {}): ISnippetRow {
  return {
    id,
    name: 'deploy',
    command: 'kubectl rollout restart deploy/api',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  } as ISnippetRow;
}

interface ITestBed {
  repo: FakeSnippetRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: SnippetSynchroniser;
}

function createTestBed(): ITestBed {
  const repo = new FakeSnippetRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new SnippetSynchroniser(repo, rowMeta, outbox, crypto, new NoopLogService());
  return { repo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SnippetSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "snippet"', () => {
    expect(bed.syncer.resourceId).toBe('snippet');
  });

  it('local add enqueues an upsert mutation carrying the encrypted full row', async () => {
    bed.syncer.start();
    bed.repo.rows.set('s1', makeSnippet('s1', { name: 'restart' }));
    bed.repo.changed$.next({ type: 'add', id: 's1' });

    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'upsert', entityId: 's1', baseVersion: null });
    // Payload is ciphertext, never plaintext business fields.
    const decoded = new TextDecoder().decode(bed.crypto.decrypt(bed.outbox.enqueued[0].payload!));
    expect(JSON.parse(decoded).command).toBe('kubectl rollout restart deploy/api');
  });

  it('local update reuses the cached server version as baseVersion (row-level LWW)', async () => {
    bed.syncer.start();
    bed.repo.rows.set('s1', makeSnippet('s1'));
    await bed.rowMeta.upsert({ resource: 'snippet', entityId: 's1', version: 4, updatedAt: Date.now() });
    bed.repo.changed$.next({ type: 'update', id: 's1' });

    await flushAsync();

    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'upsert', entityId: 's1', baseVersion: 4 });
  });

  it('local delete enqueues a delete mutation with null payload', async () => {
    bed.syncer.start();
    bed.repo.changed$.next({ type: 'delete', id: 's1' });

    await flushAsync();

    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'delete', entityId: 's1', payload: null });
  });

  it('applyPatch op=put creates a row that did not exist locally', async () => {
    bed.syncer.start();
    const row = makeSnippet('s1', { name: 'remote-create' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'snippet',
      entityId: 's1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 5,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.repo.rows.get('s1')?.name).toBe('remote-create');
    expect((await bed.rowMeta.get('snippet', 's1'))?.version).toBe(5);
  });

  it('applyPatch op=del removes the row and its row meta', async () => {
    bed.syncer.start();
    bed.repo.rows.set('s1', makeSnippet('s1'));
    await bed.rowMeta.upsert({ resource: 'snippet', entityId: 's1', version: 1, updatedAt: Date.now() });

    await bed.syncer.applyPatch([{ op: 'del', resource: 'snippet', entityId: 's1', payload: null, version: 2 }]);

    expect(bed.repo.rows.has('s1')).toBe(false);
    expect(await bed.rowMeta.get('snippet', 's1')).toBeNull();
  });

  it('applyPatch only touches its own resource', async () => {
    bed.syncer.start();
    const foreign: ISyncPatchItem = { op: 'del', resource: 'identity', entityId: 'x', payload: null, version: 9 };
    bed.repo.rows.set('x', makeSnippet('x'));

    await bed.syncer.applyPatch([foreign]);

    expect(bed.repo.rows.has('x')).toBe(true);
  });

  it('changed$ events emitted while applyPatch runs do NOT fan back to the outbox', async () => {
    bed.syncer.start();
    const row = makeSnippet('s1', { name: 'remote' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'snippet',
      entityId: 's1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 7,
    };

    await bed.syncer.applyPatch([patch]);
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot skips rows that already have a sync_row_meta entry', async () => {
    bed.repo.rows.set('s1', makeSnippet('s1'));
    bed.repo.rows.set('s2', makeSnippet('s2'));
    await bed.rowMeta.upsert({ resource: 'snippet', entityId: 's1', version: 7, updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('s2');
  });

  it('onPushAccepted persists the server-assigned version', async () => {
    await bed.syncer.onPushAccepted({ id: 1, resource: 'snippet', entityId: 's1', version: 12 });
    expect((await bed.rowMeta.get('snippet', 's1'))?.version).toBe(12);
  });

  it('reconcileGhostMeta drops local meta the server no longer holds', async () => {
    await bed.rowMeta.upsert({ resource: 'snippet', entityId: 's1', version: 1, updatedAt: Date.now() });
    await bed.rowMeta.upsert({ resource: 'snippet', entityId: 's2', version: 1, updatedAt: Date.now() });

    await bed.syncer.reconcileGhostMeta(new Set(['s2']));

    expect(await bed.rowMeta.get('snippet', 's1')).toBeNull();
    expect(await bed.rowMeta.get('snippet', 's2')).not.toBeNull();
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();

    bed.repo.changed$.next({ type: 'add', id: 's1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
