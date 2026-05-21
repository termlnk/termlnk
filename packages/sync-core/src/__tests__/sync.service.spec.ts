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
import type { ConfigRepository, ISyncCursorEntity, SyncCursorRepository } from '@termlnk/database';
import type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse, IResourceSynchroniser, ISyncMutation, ISyncOutboxService, ISyncPatchItem, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import { SynchroniserStatus, SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD } from '@termlnk/sync';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncService } from '../services/sync.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeOutbox implements ISyncOutboxService {
  pendingCount$ = new BehaviorSubject<number>(0);
  rows: ISyncMutation[] = [];
  ackedIds: number[][] = [];
  rejectedIds: Array<{ ids: number[]; reason: string }> = [];

  async enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation> {
    const m = { ...mutation, id: this.rows.length + 1, createdAt: Date.now() } as ISyncMutation;
    this.rows.push(m);
    this.pendingCount$.next(this.rows.length);
    return m;
  }

  async peek(): Promise<ISyncMutation[]> {
    return [...this.rows];
  }

  async ack(ids: number[]): Promise<void> {
    this.ackedIds.push(ids);
    const set = new Set(ids);
    this.rows = this.rows.filter((r) => !set.has(r.id));
    this.pendingCount$.next(this.rows.length);
  }

  async markRejected(ids: number[], reason: string): Promise<void> {
    this.rejectedIds.push({ ids, reason });
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    return this.rows.filter((r) => r.resource === resource).length;
  }

  async clearResource(resource: SyncResourceId): Promise<void> {
    this.rows = this.rows.filter((r) => r.resource !== resource);
    this.pendingCount$.next(this.rows.length);
  }

  async purgeByEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number> {
    if (prefixes.length === 0) {
      return 0;
    }
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => {
      if (r.resource !== resource) {
        return true;
      }
      return !prefixes.some((prefix) => r.entityId.startsWith(prefix));
    });
    const deleted = before - this.rows.length;
    if (deleted > 0) {
      this.pendingCount$.next(this.rows.length);
    }
    return deleted;
  }
}

class FakeTransport implements ISyncTransportService {
  connected$ = new BehaviorSubject<boolean>(false);
  poke$ = new Subject<IPokeMessage>();
  pushCalls: IPushRequest[] = [];
  pullCalls: IPullRequest[] = [];
  pushResponse: IPushResponse = { accepted: [], rejected: [], lastServerVersion: 0 };
  pullResponseFor: Map<SyncResourceId, IPullResponse> = new Map();
  connectCalls = 0;
  disconnectCalls = 0;
  shouldRejectConnect = false;
  // When false, connect() resolves without flipping connected$ — the test drives the
  // transition manually so it can inspect state during the "waiting for first pull" window.
  autoConnect = true;
  // When set, push/pull will throw the error instead of returning a response — used to
  // exercise lastError$ population and clearance.
  pushThrows: Error | null = null;
  pullThrows: Error | null = null;

  async push(req: IPushRequest): Promise<IPushResponse> {
    this.pushCalls.push(req);
    if (this.pushThrows) {
      throw this.pushThrows;
    }
    return this.pushResponse;
  }

  async pull(req: IPullRequest): Promise<IPullResponse> {
    this.pullCalls.push(req);
    if (this.pullThrows) {
      throw this.pullThrows;
    }
    return this.pullResponseFor.get(req.resource) ?? {
      cursor: 'cursor-1',
      patch: [],
      lastMutationId: 0,
    };
  }

  async connect(): Promise<void> {
    this.connectCalls++;
    if (this.shouldRejectConnect) {
      throw new Error('connect failed');
    }
    if (this.autoConnect) {
      this.connected$.next(true);
    }
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.connected$.next(false);
  }
}

class FakeCursorRepo {
  rows: Map<SyncResourceId, ISyncCursorEntity> = new Map();

  async get(resource: SyncResourceId): Promise<ISyncCursorEntity | null> {
    return this.rows.get(resource) ?? null;
  }

  async upsert(cursor: ISyncCursorEntity): Promise<void> {
    this.rows.set(cursor.resource, cursor);
  }

  async delete(resource: SyncResourceId): Promise<void> {
    this.rows.delete(resource);
  }
}

class FakeConfigRepo {
  store: Map<string, Map<string, unknown>> = new Map();

  async getField<T>(key: string, field: string): Promise<T | null> {
    return ((this.store.get(key)?.get(field) ?? null) as T | null);
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key)!.set(field, value);
  }
}

class FakeSynchroniser implements IResourceSynchroniser {
  status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  appliedPatches: ISyncPatchItem[][] = [];
  startCalls = 0;
  initialSnapshotCalls = 0;
  initialSnapshotError: Error | null = null;
  disposed = false;

  constructor(public readonly resourceId: SyncResourceId) {}

  start(): void {
    this.startCalls++;
  }

  async applyPatch(patch: ISyncPatchItem[]): Promise<void> {
    this.appliedPatches.push(patch);
  }

  async buildMutations(): Promise<ISyncMutation[]> {
    return [];
  }

  async buildInitialSnapshot(): Promise<ISyncMutation[]> {
    this.initialSnapshotCalls++;
    if (this.initialSnapshotError) {
      throw this.initialSnapshotError;
    }
    return [];
  }

  dispose(): void {
    this.disposed = true;
  }
}

interface ITestBed {
  outbox: FakeOutbox;
  transport: FakeTransport;
  cursors: FakeCursorRepo;
  config: FakeConfigRepo;
  service: SyncService;
}

function createTestBed(): ITestBed {
  const outbox = new FakeOutbox();
  const transport = new FakeTransport();
  const cursors = new FakeCursorRepo();
  const config = new FakeConfigRepo();
  const service = new SyncService(
    outbox,
    transport,
    cursors as unknown as SyncCursorRepository,
    config as unknown as ConfigRepository,
    new NoopLogService()
  );
  return { outbox, transport, cursors, config, service };
}

async function flushAsync(extraMs: number = 0): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  if (extraMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, extraMs));
  }
  await Promise.resolve();
  await Promise.resolve();
}

describe('SyncService', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.service.dispose();
  });

  it('starts in Disabled state with disabled enabled flag', async () => {
    expect(await firstValue(bed.service.state$)).toBe('disabled');
    expect(await firstValue(bed.service.enabled$)).toBe(false);
  });

  it('register adds the synchroniser; double-register on the same resource throws', () => {
    const a = new FakeSynchroniser('host');
    const b = new FakeSynchroniser('host');
    bed.service.register(a);
    expect(() => bed.service.register(b)).toThrow(/already registered/);
  });

  it('enable starts each registered synchroniser and connects the transport', async () => {
    const sk = new FakeSynchroniser('skill');
    const mc = new FakeSynchroniser('mcp_server');
    bed.service.register(sk);
    bed.service.register(mc);

    await bed.service.enable();

    expect(sk.startCalls).toBe(1);
    expect(mc.startCalls).toBe(1);
    expect(bed.transport.connectCalls).toBe(1);
    expect(await firstValue(bed.service.enabled$)).toBe(true);
  });

  it('enable seeds initial snapshot for every registered synchroniser', async () => {
    const sk = new FakeSynchroniser('skill');
    const mc = new FakeSynchroniser('mcp_server');
    bed.service.register(sk);
    bed.service.register(mc);

    await bed.service.enable();

    expect(sk.initialSnapshotCalls).toBe(1);
    expect(mc.initialSnapshotCalls).toBe(1);
  });

  it('enable swallows initial snapshot failures and keeps going for the next synchroniser', async () => {
    const failing = new FakeSynchroniser('skill');
    failing.initialSnapshotError = new Error('snapshot boom');
    const ok = new FakeSynchroniser('mcp_server');
    bed.service.register(failing);
    bed.service.register(ok);

    await expect(bed.service.enable()).resolves.toBeUndefined();

    expect(failing.initialSnapshotCalls).toBe(1);
    expect(ok.initialSnapshotCalls).toBe(1);
    expect(bed.transport.connectCalls).toBe(1);
  });

  it('enable persists a fresh clientId on first run; reuses it on subsequent runs', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();

    const persisted = await bed.config.getField<string>('sync.config', 'clientId');
    expect(persisted).toBeTruthy();

    await bed.service.disable();

    const bed2 = createTestBed();
    bed2.config.store = bed.config.store; // reuse the stored clientId
    bed2.service.register(new FakeSynchroniser('skill'));
    await bed2.service.enable();

    expect(bed2.transport.pullCalls[0]?.clientId).toBe(persisted);
    bed2.service.dispose();
  });

  it('enable triggers an immediate pull for every SYNC_RESOURCES entry', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    bed.service.register(new FakeSynchroniser('host'));
    await bed.service.enable();
    await flushAsync(50);

    // SYNC_RESOURCES = ['host', 'config', 'ai_provider', 'mcp_server', 'skill'] — only the
    // registered ones get a transport pull (others are skipped silently)
    expect(bed.transport.pullCalls.map((c) => c.resource).sort()).toEqual(['host', 'skill']);
  });

  it('disable disconnects the transport and stops accepting triggers', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();

    await bed.service.disable();

    expect(bed.transport.disconnectCalls).toBe(1);
    expect(await firstValue(bed.service.enabled$)).toBe(false);

    // Push trigger should be ignored
    await bed.service.syncNow();
    await flushAsync();
    // No additional push beyond the one in enable() — actually enable doesn't push (only pulls)
    expect(bed.transport.pushCalls.length).toBe(0);
  });

  it('push happens after debounce window when the outbox grows', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.pushCalls.length = 0;
    bed.transport.pushResponse = { accepted: [1], rejected: [], lastServerVersion: 1 };

    await bed.outbox.enqueue({
      resource: 'skill',
      op: 'upsert',
      entityId: 's1',
      payload: new Uint8Array([1, 2, 3]),
      baseVersion: null,
    });
    await flushAsync(600); // debounce 500ms + headroom

    expect(bed.transport.pushCalls.length).toBe(1);
    expect(bed.transport.pushCalls[0].mutations).toHaveLength(1);
    expect(bed.outbox.ackedIds.flat()).toContain(1);
  });

  it('push rejection triggers a follow-up pull', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.pushCalls.length = 0;
    bed.transport.pullCalls.length = 0;
    bed.transport.pushResponse = {
      accepted: [],
      rejected: [{ id: 1, reason: 'baseVersion mismatch' }],
      lastServerVersion: 1,
    };

    await bed.outbox.enqueue({
      resource: 'skill',
      op: 'upsert',
      entityId: 's1',
      payload: new Uint8Array(0),
      baseVersion: null,
    });
    await flushAsync(600);

    expect(bed.transport.pushCalls.length).toBe(1);
    expect(bed.outbox.rejectedIds[0]?.ids).toContain(1);
    // Pull was triggered by rejection
    expect(bed.transport.pullCalls.length).toBeGreaterThan(0);
  });

  it('poke triggers a pull (after the 200ms debounce)', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.pullCalls.length = 0;
    bed.transport.poke$.next({ type: 'poke', resource: 'skill', cursor: 'srv-1' });
    await flushAsync(300);

    expect(bed.transport.pullCalls.some((c) => c.resource === 'skill')).toBe(true);
  });

  it('pull applies returned patches to the matching synchroniser and updates cursor', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    bed.transport.pullResponseFor.set('skill', {
      cursor: 'cursor-after-skill',
      patch: [{
        op: 'put',
        resource: 'skill',
        entityId: 's1',
        payload: new Uint8Array([1]),
        version: 5,
      }],
      lastMutationId: 0,
    });

    await bed.service.enable();
    await flushAsync(50);

    expect(sk.appliedPatches.length).toBe(1);
    expect(sk.appliedPatches[0]).toHaveLength(1);
    expect((await bed.cursors.get('skill'))?.cursor).toBe('cursor-after-skill');
  });

  it('forceFullResync clears every cursor and the next pull request carries cursor=null', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();
    await flushAsync(50);
    await bed.cursors.upsert({ resource: 'skill', cursor: 'old', lastPulledAt: 1 });
    bed.transport.pullCalls.length = 0;

    await bed.service.forceFullResync();
    await flushAsync(50);

    // At least one pull was triggered.
    expect(bed.transport.pullCalls.length).toBeGreaterThan(0);
    // That pull's cursor must be null — full resync starts from scratch.
    expect(bed.transport.pullCalls[0].cursor).toBeNull();
  });

  it('disconnect flips state to Offline; reconnect triggers a catch-up pull', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.connected$.next(false);
    expect(await firstValue(bed.service.state$)).toBe('offline');

    bed.transport.pullCalls.length = 0;
    bed.transport.connected$.next(true);
    await flushAsync(50);

    // Reconnect path triggered a pull; final state settles to idle once it completes
    expect(bed.transport.pullCalls.length).toBeGreaterThan(0);
    expect(await firstValue(bed.service.state$)).toBe('idle');
  });

  it('failed transport.connect is logged but does not throw out of enable', async () => {
    bed.transport.shouldRejectConnect = true;
    bed.service.register(new FakeSynchroniser('skill'));
    await expect(bed.service.enable()).resolves.toBeUndefined();
    expect(await firstValue(bed.service.state$)).toBe('offline');
  });

  it('dispose disposes registered synchronisers and completes all observables', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    bed.service.dispose();

    expect(sk.disposed).toBe(true);
  });

  // Regression: enable() used to flip state straight to Idle while lastSyncedAt was
  // still null, so the UI showed "Up to date / Never synced". State must hold Syncing
  // until the first pull populates stats.lastSyncedAt.
  it('enable holds Syncing across the connect→firstPull window', async () => {
    bed.transport.autoConnect = false;
    bed.service.register(new FakeSynchroniser('skill'));

    await bed.service.enable();

    // Pre-connect: BehaviorSubject(false) replays through transportSub → Offline.
    expect(await firstValue(bed.service.state$)).toBe('offline');
    const statsBefore = await firstValue(bed.service.stats$);
    expect(statsBefore.lastSyncedAt).toBeNull();

    bed.transport.connected$.next(true);
    await flushAsync(50);

    expect(await firstValue(bed.service.state$)).toBe('idle');
    const statsAfter = await firstValue(bed.service.stats$);
    expect(statsAfter.lastSyncedAt).not.toBeNull();
  });

  // Regression: push-only success used to light "Up to date" while lastSyncedAt was
  // still 3-days-old (the reported "Up to date / 3 days ago" bug). Push must not flip
  // state to Idle before the first pull completes.
  it('push success alone does not flip state to Idle before first pull', async () => {
    bed.transport.autoConnect = false;
    bed.service.register(new FakeSynchroniser('skill'));

    await bed.outbox.enqueue({
      resource: 'skill',
      op: 'upsert',
      entityId: 's1',
      payload: new Uint8Array([1, 2, 3]),
      baseVersion: null,
    });
    bed.transport.pushResponse = { accepted: [1], rejected: [], lastServerVersion: 1 };

    await bed.service.enable();
    await flushAsync(700); // past the 500ms push debounce

    expect(bed.transport.pushCalls.length).toBeGreaterThan(0);
    expect(await firstValue(bed.service.state$)).not.toBe('idle');
  });

  // Regression: lastError$ was only cleared on enable(); a transient pull failure left
  // the red banner up forever, even after the next pull succeeded.
  it('successful pull clears a previously surfaced lastError', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    bed.transport.pullThrows = new Error('boom');

    await bed.service.enable();
    await flushAsync(50);

    expect((await firstValue(bed.service.lastError$))?.code).toBe('network');

    bed.transport.pullThrows = null;
    await bed.service.syncNow();
    await flushAsync(50);

    expect(await firstValue(bed.service.lastError$)).toBeNull();
  });

  // Manual retry must clear the banner synchronously so the UI doesn't stay red while
  // the retry is already in flight.
  it('syncNow clears lastError immediately', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    bed.transport.pullThrows = new Error('boom');

    await bed.service.enable();
    await flushAsync(50);

    expect(await firstValue(bed.service.lastError$)).not.toBeNull();

    await bed.service.syncNow();
    expect(await firstValue(bed.service.lastError$)).toBeNull();
  });

  // Regression: persisted userEnabled is the single source AuthSyncBridgeController
  // reads after restart — enable/disable must write it; stopRuntime must not.
  it('enable persists userEnabled=true to ConfigRepository', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();
    expect(await bed.config.getField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD)).toBe(true);
  });

  it('disable persists userEnabled=false to ConfigRepository', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();
    await bed.service.disable();
    expect(await bed.config.getField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD)).toBe(false);
  });

  it('stopRuntime stops the runtime without changing persisted userEnabled', async () => {
    bed.service.register(new FakeSynchroniser('skill'));
    await bed.service.enable();
    expect(await bed.config.getField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD)).toBe(true);

    await bed.service.stopRuntime();

    expect(await firstValue(bed.service.enabled$)).toBe(false);
    expect(await firstValue(bed.service.state$)).toBe('disabled');
    expect(await bed.config.getField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD)).toBe(true);
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
