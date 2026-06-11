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
  IPortForwardingRuleSyncRepository,
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
import { PortForwardingRuleSynchroniser } from '../synchronisers/port-forwarding-rule-synchroniser';

// PortForwardingRule has no concrete DB entity yet (per-platform repositories land in the
// desktop / mobile implementation sub-tasks), so these tests exercise the synchroniser purely
// against the @termlnk/sync contract. Only the rule definition syncs; runtime tunnel state is
// never persisted and never enters the sync stream.
interface IPortForwardingRuleRow extends ISyncEntityRow {
  type: 'local' | 'remote' | 'dynamic';
  hostId: string;
  bindAddress: string;
  bindPort: number;
  destHost?: string | null;
  destPort?: number | null;
}

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeRuleRepo implements IPortForwardingRuleSyncRepository {
  rows: Map<string, IPortForwardingRuleRow> = new Map();
  changed$: Subject<{ type: 'add' | 'update' | 'delete'; id: string }> = new Subject();

  async getList(): Promise<IPortForwardingRuleRow[]> {
    return [...this.rows.values()];
  }

  async getById(id: string): Promise<IPortForwardingRuleRow | undefined> {
    return this.rows.get(id);
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const existed = this.rows.has(entity.id);
    this.rows.set(entity.id, entity as IPortForwardingRuleRow);
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

function makeRule(id: string, overrides: Partial<IPortForwardingRuleRow> = {}): IPortForwardingRuleRow {
  return {
    id,
    type: 'local',
    hostId: 'h1',
    bindAddress: '127.0.0.1',
    bindPort: 8080,
    destHost: '10.0.0.5',
    destPort: 80,
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  } as IPortForwardingRuleRow;
}

interface ITestBed {
  repo: FakeRuleRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: PortForwardingRuleSynchroniser;
}

function createTestBed(): ITestBed {
  const repo = new FakeRuleRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new PortForwardingRuleSynchroniser(repo, rowMeta, outbox, crypto, new NoopLogService());
  return { repo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('PortForwardingRuleSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "port_forwarding_rule"', () => {
    expect(bed.syncer.resourceId).toBe('port_forwarding_rule');
  });

  it('local add enqueues an upsert mutation carrying the encrypted full row', async () => {
    bed.syncer.start();
    bed.repo.rows.set('r1', makeRule('r1', { type: 'remote', bindPort: 9090 }));
    bed.repo.changed$.next({ type: 'add', id: 'r1' });

    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'upsert', entityId: 'r1', baseVersion: null });
    const decoded = new TextDecoder().decode(bed.crypto.decrypt(bed.outbox.enqueued[0].payload!));
    expect(JSON.parse(decoded)).toMatchObject({ type: 'remote', bindPort: 9090 });
  });

  it('local update reuses the cached server version as baseVersion (row-level LWW)', async () => {
    bed.syncer.start();
    bed.repo.rows.set('r1', makeRule('r1'));
    await bed.rowMeta.upsert({ resource: 'port_forwarding_rule', entityId: 'r1', version: 3, updatedAt: Date.now() });
    bed.repo.changed$.next({ type: 'update', id: 'r1' });

    await flushAsync();

    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'upsert', entityId: 'r1', baseVersion: 3 });
  });

  it('local delete enqueues a delete mutation with null payload', async () => {
    bed.syncer.start();
    bed.repo.changed$.next({ type: 'delete', id: 'r1' });

    await flushAsync();

    expect(bed.outbox.enqueued[0]).toMatchObject({ op: 'delete', entityId: 'r1', payload: null });
  });

  it('applyPatch op=put creates a row that did not exist locally', async () => {
    bed.syncer.start();
    const row = makeRule('r1', { type: 'dynamic', destHost: null, destPort: null });
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'port_forwarding_rule',
      entityId: 'r1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 5,
    };

    await bed.syncer.applyPatch([patch]);

    expect(bed.repo.rows.get('r1')?.type).toBe('dynamic');
    expect((await bed.rowMeta.get('port_forwarding_rule', 'r1'))?.version).toBe(5);
  });

  it('applyPatch op=del removes the row and its row meta', async () => {
    bed.syncer.start();
    bed.repo.rows.set('r1', makeRule('r1'));
    await bed.rowMeta.upsert({ resource: 'port_forwarding_rule', entityId: 'r1', version: 1, updatedAt: Date.now() });

    await bed.syncer.applyPatch([{ op: 'del', resource: 'port_forwarding_rule', entityId: 'r1', payload: null, version: 2 }]);

    expect(bed.repo.rows.has('r1')).toBe(false);
    expect(await bed.rowMeta.get('port_forwarding_rule', 'r1')).toBeNull();
  });

  it('applyPatch only touches its own resource', async () => {
    bed.syncer.start();
    bed.repo.rows.set('r1', makeRule('r1'));

    await bed.syncer.applyPatch([{ op: 'del', resource: 'snippet', entityId: 'r1', payload: null, version: 9 }]);

    expect(bed.repo.rows.has('r1')).toBe(true);
  });

  it('changed$ events emitted while applyPatch runs do NOT fan back to the outbox', async () => {
    bed.syncer.start();
    const row = makeRule('r1');
    const patch: ISyncPatchItem = {
      op: 'put',
      resource: 'port_forwarding_rule',
      entityId: 'r1',
      payload: bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify(row))),
      version: 7,
    };

    await bed.syncer.applyPatch([patch]);
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot skips rows that already have a sync_row_meta entry', async () => {
    bed.repo.rows.set('r1', makeRule('r1'));
    bed.repo.rows.set('r2', makeRule('r2'));
    await bed.rowMeta.upsert({ resource: 'port_forwarding_rule', entityId: 'r1', version: 7, updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('r2');
  });

  it('onPushAccepted persists the server-assigned version', async () => {
    await bed.syncer.onPushAccepted({ id: 1, resource: 'port_forwarding_rule', entityId: 'r1', version: 8 });
    expect((await bed.rowMeta.get('port_forwarding_rule', 'r1'))?.version).toBe(8);
  });

  it('reconcileGhostMeta drops local meta the server no longer holds', async () => {
    await bed.rowMeta.upsert({ resource: 'port_forwarding_rule', entityId: 'r1', version: 1, updatedAt: Date.now() });
    await bed.rowMeta.upsert({ resource: 'port_forwarding_rule', entityId: 'r2', version: 1, updatedAt: Date.now() });

    await bed.syncer.reconcileGhostMeta(new Set(['r2']));

    expect(await bed.rowMeta.get('port_forwarding_rule', 'r1')).toBeNull();
    expect(await bed.rowMeta.get('port_forwarding_rule', 'r2')).not.toBeNull();
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();

    bed.repo.changed$.next({ type: 'add', id: 'r1' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
