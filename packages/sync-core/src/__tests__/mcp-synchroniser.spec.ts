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
import type { IMcpServerEntity, IMcpServerEntityInsert, ISyncRowMetaEntity, McpServerRepository, SyncRowMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpSynchroniser } from '../synchronisers/mcp-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeMcpRepo {
  rows: Map<string, IMcpServerEntity> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete'; id: string }> = new Subject();

  async getAll(): Promise<IMcpServerEntity[]> {
    return [...this.rows.values()];
  }

  async getById(id: string): Promise<IMcpServerEntity | undefined> {
    return this.rows.get(id);
  }

  async create(record: Omit<IMcpServerEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id ?? `gen-${Date.now()}`;
    this.rows.set(id, { ...record, id } as IMcpServerEntity);
    this.changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: Partial<Omit<IMcpServerEntityInsert, 'id'>>): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) {
      return;
    }
    this.rows.set(id, { ...existing, ...updates } as IMcpServerEntity);
    this.changed$.next({ type: 'update', id });
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
  async purgeByEntityIdPrefixes(): Promise<number> {
    return 0;
  }
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

function makeServer(id: string, overrides: Partial<IMcpServerEntity> = {}): IMcpServerEntity {
  return {
    id,
    registryId: null,
    name: 'demo-server',
    description: 'demo',
    transport: 'stdio' as never,
    config: { type: 'stdio', command: '/bin/demo', args: [], env: {} } as never,
    capabilities: null,
    toolCount: 0,
    resourceCount: 0,
    enabled: true,
    status: 'disconnected' as never,
    lastError: null,
    accessedAt: '2026-05-09T00:00:00.000Z',
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

interface ITestBed {
  mcpRepo: FakeMcpRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: McpSynchroniser;
}

function createTestBed(): ITestBed {
  const mcpRepo = new FakeMcpRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new McpSynchroniser(
    mcpRepo as unknown as McpServerRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { mcpRepo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('McpSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "mcp_server"', () => {
    expect(bed.syncer.resourceId).toBe('mcp_server');
  });

  it('local update enqueues an upsert mutation with encrypted full row', async () => {
    bed.syncer.start();
    const row = makeServer('m1', { name: 'updated' });
    bed.mcpRepo.rows.set('m1', row);
    bed.mcpRepo.changed$.next({ type: 'update', id: 'm1' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('m1');
    expect(bed.outbox.enqueued[0].op).toBe('upsert');
  });

  it('local delete enqueues a delete mutation with null payload', async () => {
    bed.syncer.start();
    bed.mcpRepo.changed$.next({ type: 'delete', id: 'm1' });

    await flushAsync();
    expect(bed.outbox.enqueued[0]).toMatchObject({
      op: 'delete',
      entityId: 'm1',
      payload: null,
    });
  });

  it('applyPatch op=put creates a row that did not exist locally', async () => {
    bed.syncer.start();
    const row = makeServer('m1', { name: 'remote-create' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'mcp_server',
      entityId: 'm1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 5,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.mcpRepo.rows.get('m1')?.name).toBe('remote-create');
    expect((await bed.rowMeta.get('mcp_server', 'm1'))?.version).toBe(5);
  });

  it('applyPatch op=put updates an existing row in place', async () => {
    bed.syncer.start();
    bed.mcpRepo.rows.set('m1', makeServer('m1', { name: 'original' }));
    const updated = makeServer('m1', { name: 'rotated' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'mcp_server',
      entityId: 'm1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(updated))),
      version: 6,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.mcpRepo.rows.get('m1')?.name).toBe('rotated');
  });

  it('applyPatch op=del removes the row and its row meta', async () => {
    bed.syncer.start();
    bed.mcpRepo.rows.set('m1', makeServer('m1'));
    await bed.rowMeta.upsert({ resource: 'mcp_server', entityId: 'm1', version: 1, updatedAt: Date.now() });

    await bed.syncer.applyPatch([{ op: 'del', resource: 'mcp_server', entityId: 'm1', payload: null, version: 2 }]);

    expect(bed.mcpRepo.rows.has('m1')).toBe(false);
    expect(await bed.rowMeta.get('mcp_server', 'm1')).toBeNull();
  });

  it('changed$ events emitted while applyPatch is running do NOT fan back to outbox', async () => {
    bed.syncer.start();
    const row = makeServer('m1', { name: 'remote' });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'mcp_server',
      entityId: 'm1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 7,
    };

    await bed.syncer.applyPatch([patch]);
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot enqueues one upsert per existing row', async () => {
    bed.mcpRepo.rows.set('m1', makeServer('m1'));
    bed.mcpRepo.rows.set('m2', makeServer('m2'));

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(2);
    expect(bed.outbox.enqueued).toHaveLength(2);
  });

  it('buildInitialSnapshot skips rows that already have a sync_row_meta entry', async () => {
    bed.mcpRepo.rows.set('m1', makeServer('m1'));
    bed.mcpRepo.rows.set('m2', makeServer('m2'));
    await bed.rowMeta.upsert({ resource: 'mcp_server', entityId: 'm1', version: 7, updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(1);
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('m2');
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();

    bed.mcpRepo.changed$.next({ type: 'add', id: 'm1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
