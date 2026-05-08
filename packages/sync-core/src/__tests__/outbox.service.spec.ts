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
import type { ConfigRepository, ISyncOutboxEntity, ISyncOutboxEntityInsert, SyncOutboxRepository } from '@termlnk/database';
import type { ISyncMutation, SyncResourceId } from '@termlnk/sync';
import { Buffer } from 'node:buffer';
import { SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncOutboxService } from '../services/outbox.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

/**
 * In-memory 假 SyncOutboxRepository——只测 Service 的业务逻辑（FIFO 顺序、计数、ID 分配），
 * 不测 SQL 行为（那是 Drizzle/SQLite 的责任）。
 *
 * 真 Repository 的 SQL 行为需在 @termlnk/database 自己的集成测试里验证（带真 SQLite native binding）。
 */
class FakeOutboxRepository {
  private _rows: ISyncOutboxEntity[] = [];
  private _idCounter = 0;

  async insert(record: Omit<ISyncOutboxEntityInsert, 'id'> & { id?: string }): Promise<ISyncOutboxEntity> {
    const id = record.id ?? `gen-${++this._idCounter}`;
    const row: ISyncOutboxEntity = {
      id,
      clientMutId: record.clientMutId,
      resource: record.resource as SyncResourceId,
      op: record.op,
      entityId: record.entityId,
      payload: record.payload === null || record.payload === undefined ? null : Buffer.from(record.payload),
      baseVersion: record.baseVersion ?? null,
      createdAt: record.createdAt,
      retryCount: record.retryCount ?? 0,
    };
    this._rows.push(row);
    return row;
  }

  async selectFifo(limit?: number): Promise<ISyncOutboxEntity[]> {
    const sorted = [...this._rows].sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.clientMutId - b.clientMutId;
    });
    return limit && limit > 0 ? sorted.slice(0, limit) : sorted;
  }

  async deleteByClientMutIds(ids: number[]): Promise<void> {
    const drop = new Set(ids);
    this._rows = this._rows.filter((r) => !drop.has(r.clientMutId));
  }

  async incrementRetry(ids: number[]): Promise<void> {
    const target = new Set(ids);
    for (const r of this._rows) {
      if (target.has(r.clientMutId)) {
        r.retryCount += 1;
      }
    }
  }

  async countAll(): Promise<number> {
    return this._rows.length;
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    return this._rows.filter((r) => r.resource === resource).length;
  }

  async deleteByResource(resource: SyncResourceId): Promise<void> {
    this._rows = this._rows.filter((r) => r.resource !== resource);
  }

  async maxClientMutId(): Promise<number> {
    return this._rows.reduce((max, r) => Math.max(max, r.clientMutId), 0);
  }

  // For tests: peek at internal state
  _allRows(): readonly ISyncOutboxEntity[] {
    return this._rows;
  }
}

class FakeConfigRepository {
  private _kv: Map<string, Record<string, unknown>> = new Map();

  async getField<T>(key: string, field: string): Promise<T | null> {
    const obj = this._kv.get(key);
    if (!obj) {
      return null;
    }
    return (obj[field] ?? null) as T | null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    const obj = this._kv.get(key) ?? {};
    obj[field] = value;
    this._kv.set(key, obj);
  }
}

interface ITestBed {
  outboxRepo: FakeOutboxRepository;
  configRepo: FakeConfigRepository;
  logService: NoopLogService;
  service: SyncOutboxService;
}

async function createTestBed(): Promise<ITestBed> {
  const outboxRepo = new FakeOutboxRepository();
  const configRepo = new FakeConfigRepository();
  const logService = new NoopLogService();
  const service = new SyncOutboxService(
    outboxRepo as unknown as SyncOutboxRepository,
    configRepo as unknown as ConfigRepository,
    logService
  );
  // 等待构造期的 hydrate 完成
  await service.peek(1);
  return { outboxRepo, configRepo, logService, service };
}

function buildSampleMutation(overrides: Partial<Omit<ISyncMutation, 'id' | 'createdAt'>> = {}): Omit<ISyncMutation, 'id' | 'createdAt'> {
  return {
    resource: 'host',
    op: 'upsert',
    entityId: 'host-1',
    payload: new Uint8Array([0xAA, 0xBB, 0xCC]),
    baseVersion: null,
    ...overrides,
  };
}

describe('SyncOutboxService', () => {
  let bed: ITestBed;

  beforeEach(async () => {
    bed = await createTestBed();
  });

  afterEach(() => {
    bed.service.dispose();
  });

  it('starts empty with pendingCount = 0', async () => {
    expect(await firstValue(bed.service.pendingCount$)).toBe(0);
  });

  it('enqueue allocates monotonic clientMutId starting at 1', async () => {
    const a = await bed.service.enqueue(buildSampleMutation());
    const b = await bed.service.enqueue(buildSampleMutation({ entityId: 'host-2' }));
    const c = await bed.service.enqueue(buildSampleMutation({ entityId: 'host-3' }));

    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(c.id).toBe(3);
  });

  it('enqueue persists payload bytes round-trip', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    await bed.service.enqueue(buildSampleMutation({ payload }));

    const queued = await bed.service.peek();
    expect(queued).toHaveLength(1);
    expect(queued[0].payload).toEqual(payload);
  });

  it('enqueue persists null payload for delete ops', async () => {
    await bed.service.enqueue(buildSampleMutation({ op: 'delete', payload: null }));
    const queued = await bed.service.peek();
    expect(queued[0].payload).toBeNull();
    expect(queued[0].op).toBe('delete');
  });

  it('peek returns FIFO order by createdAt then clientMutId', async () => {
    await bed.service.enqueue(buildSampleMutation({ entityId: 'a' }));
    await bed.service.enqueue(buildSampleMutation({ entityId: 'b' }));
    await bed.service.enqueue(buildSampleMutation({ entityId: 'c' }));

    const all = await bed.service.peek();
    expect(all.map((m) => m.entityId)).toEqual(['a', 'b', 'c']);
  });

  it('peek honors limit', async () => {
    for (let i = 0; i < 5; i++) {
      await bed.service.enqueue(buildSampleMutation({ entityId: `host-${i}` }));
    }
    const head = await bed.service.peek(2);
    expect(head).toHaveLength(2);
  });

  it('ack removes only the specified clientMutIds and updates pendingCount', async () => {
    const a = await bed.service.enqueue(buildSampleMutation({ entityId: 'a' }));
    const b = await bed.service.enqueue(buildSampleMutation({ entityId: 'b' }));
    const c = await bed.service.enqueue(buildSampleMutation({ entityId: 'c' }));
    expect(await firstValue(bed.service.pendingCount$)).toBe(3);

    await bed.service.ack([a.id, c.id]);

    const remaining = await bed.service.peek();
    expect(remaining.map((m) => m.id)).toEqual([b.id]);
    expect(await firstValue(bed.service.pendingCount$)).toBe(1);
  });

  it('ack with empty list is a no-op', async () => {
    await bed.service.enqueue(buildSampleMutation());
    await bed.service.ack([]);
    expect(await firstValue(bed.service.pendingCount$)).toBe(1);
  });

  it('markRejected increments retry_count without removing the row or changing pendingCount', async () => {
    const m = await bed.service.enqueue(buildSampleMutation());
    expect(await firstValue(bed.service.pendingCount$)).toBe(1);

    await bed.service.markRejected([m.id], 'baseVersion mismatch');
    await bed.service.markRejected([m.id], 'still bad');

    const rows = bed.outboxRepo._allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].retryCount).toBe(2);
    expect(await firstValue(bed.service.pendingCount$)).toBe(1);
  });

  it('countByResource scopes the count to one resource type', async () => {
    await bed.service.enqueue(buildSampleMutation({ resource: 'host', entityId: 'h1' }));
    await bed.service.enqueue(buildSampleMutation({ resource: 'host', entityId: 'h2' }));
    await bed.service.enqueue(buildSampleMutation({ resource: 'mcp_server', entityId: 's1' }));

    expect(await bed.service.countByResource('host')).toBe(2);
    expect(await bed.service.countByResource('mcp_server')).toBe(1);
    expect(await bed.service.countByResource('skill')).toBe(0);
  });

  it('clearResource drops only that resource and refreshes pendingCount', async () => {
    await bed.service.enqueue(buildSampleMutation({ resource: 'host', entityId: 'h1' }));
    await bed.service.enqueue(buildSampleMutation({ resource: 'mcp_server', entityId: 's1' }));
    expect(await firstValue(bed.service.pendingCount$)).toBe(2);

    await bed.service.clearResource('host');

    expect(await bed.service.countByResource('host')).toBe(0);
    expect(await bed.service.countByResource('mcp_server')).toBe(1);
    expect(await firstValue(bed.service.pendingCount$)).toBe(1);
  });

  it('persists lastClientMutId across instance recreation (high water mark survives outbox flush)', async () => {
    await bed.service.enqueue(buildSampleMutation({ entityId: 'a' }));
    const second = await bed.service.enqueue(buildSampleMutation({ entityId: 'b' }));
    expect(second.id).toBe(2);

    await bed.service.ack([1, 2]);
    expect(await firstValue(bed.service.pendingCount$)).toBe(0);

    expect(
      await bed.configRepo.getField<number>(SYNC_PLUGIN_CONFIG_KEY, 'lastClientMutId')
    ).toBe(2);

    bed.service.dispose();

    const reborn = new SyncOutboxService(
      bed.outboxRepo as unknown as SyncOutboxRepository,
      bed.configRepo as unknown as ConfigRepository,
      bed.logService
    );
    bed.service = reborn;
    await reborn.peek(1);

    const next = await reborn.enqueue(buildSampleMutation({ entityId: 'c' }));
    expect(next.id).toBe(3);
  });

  it('hydrates clientMutId counter from pre-existing outbox rows when high water unset', async () => {
    // Pre-populate one row directly via the repo (simulates rows surviving from a prior session
    // where the high-water mark was lost — the dbMax fallback must still give the right answer)
    await bed.outboxRepo.insert({
      clientMutId: 7,
      resource: 'host',
      op: 'upsert',
      entityId: 'pre-existing',
      payload: Buffer.from([0]),
      baseVersion: null,
      createdAt: Date.now(),
    });

    bed.service.dispose();
    const fresh = new SyncOutboxService(
      bed.outboxRepo as unknown as SyncOutboxRepository,
      bed.configRepo as unknown as ConfigRepository,
      bed.logService
    );
    bed.service = fresh;
    await fresh.peek(1);

    expect(await firstValue(fresh.pendingCount$)).toBe(1);

    const queued = await fresh.enqueue(buildSampleMutation({ entityId: 'after-hydrate' }));
    expect(queued.id).toBe(8); // max(persistedHighWater=null→0, dbMax=7) + 1
  });

  it('disposes cleanly: pendingCount$ completes', async () => {
    let completed = false;
    const sub = bed.service.pendingCount$.subscribe({
      complete: () => {
        completed = true;
      },
    });
    bed.service.dispose();
    expect(completed).toBe(true);
    sub.unsubscribe();
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
