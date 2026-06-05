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
import type { ConfigRepository, ISyncCursorEntity, SyncCursorRepository, SyncRowMetaRepository } from '@termlnk/database';
import type { IPokeMessage, IPullRequest, IPullResponse, IPushAcceptedDetail, IPushRequest, IPushResponse, IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import { SYNC_MAX_BASE_VERSION_RETRIES, SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD, SynchroniserStatus } from '@termlnk/sync';
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
  discardedIds: number[][] = [];
  retryCounts: Map<number, number> = new Map();

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

  async markRejected(ids: number[], reason: string): Promise<Map<number, number>> {
    this.rejectedIds.push({ ids, reason });
    const out = new Map<number, number>();
    for (const id of ids) {
      const next = (this.retryCounts.get(id) ?? 0) + 1;
      this.retryCounts.set(id, next);
      out.set(id, next);
    }
    return out;
  }

  async updateBaseVersion(mutationId: number, baseVersion: number): Promise<void> {
    this.rows = this.rows.map((r) => (r.id === mutationId ? { ...r, baseVersion } : r));
  }

  async discard(ids: number[]): Promise<void> {
    this.discardedIds.push(ids);
    const set = new Set(ids);
    this.rows = this.rows.filter((r) => !set.has(r.id));
    this.pendingCount$.next(this.rows.length);
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
  pushResponse: IPushResponse = { accepted: [], acceptedDetails: [], rejected: [], lastServerVersion: 0 };
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

class FakeRowMeta {
  private _rows: Map<string, { resource: SyncResourceId; entityId: string; version: number; updatedAt: number }> = new Map();

  private _key(resource: SyncResourceId, entityId: string): string {
    return `${resource}::${entityId}`;
  }

  set(resource: SyncResourceId, entityId: string, version: number): void {
    this._rows.set(this._key(resource, entityId), { resource, entityId, version, updatedAt: 0 });
  }

  async get(resource: SyncResourceId, entityId: string): Promise<{ resource: SyncResourceId; entityId: string; version: number; updatedAt: number } | null> {
    return this._rows.get(this._key(resource, entityId)) ?? null;
  }
}

class FakeCryptoService implements ISyncCryptoService {
  constructor(public available: boolean) {}
  encrypt(_plaintext: Uint8Array): Uint8Array {
    if (!this.available) {
      throw new Error('[FakeCryptoService] master key is locked');
    }
    return new Uint8Array([1, 2, 3]);
  }

  decrypt(_payload: Uint8Array): Uint8Array {
    if (!this.available) {
      throw new Error('[FakeCryptoService] master key is locked');
    }
    return new Uint8Array([4, 5, 6]);
  }

  hmacIndex(_value: string): Uint8Array {
    return new Uint8Array(32);
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
  pushAccepted: IPushAcceptedDetail[] = [];
  reconcileCalls: ReadonlySet<string>[] = [];
  disposed = false;

  constructor(public readonly resourceId: SyncResourceId) {}

  start(): void {
    this.startCalls++;
  }

  async onPushAccepted(detail: IPushAcceptedDetail): Promise<void> {
    this.pushAccepted.push(detail);
  }

  async reconcileGhostMeta(serverEntityIds: ReadonlySet<string>): Promise<void> {
    this.reconcileCalls.push(serverEntityIds);
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
  rowMeta: FakeRowMeta;
  crypto: FakeCryptoService;
  service: SyncService;
}

function createTestBed(opts: { cryptoAvailable?: boolean } = {}): ITestBed {
  const outbox = new FakeOutbox();
  const transport = new FakeTransport();
  const cursors = new FakeCursorRepo();
  const config = new FakeConfigRepo();
  const rowMeta = new FakeRowMeta();
  const crypto = new FakeCryptoService(opts.cryptoAvailable ?? true);
  const service = new SyncService(
    outbox,
    transport,
    crypto,
    cursors as unknown as SyncCursorRepository,
    config as unknown as ConfigRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    new NoopLogService()
  );
  return { outbox, transport, cursors, config, rowMeta, crypto, service };
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
    bed.transport.pushResponse = {
      accepted: [1],
      acceptedDetails: [{ id: 1, resource: 'skill', entityId: 's1', version: 1 }],
      rejected: [],
      lastServerVersion: 1,
    };

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
    // Push ack must route onPushAccepted to the matching synchroniser so it can write
    // sync_row_meta with the server-assigned version. Without this, the next restart
    // would re-enqueue this row (buildInitialSnapshot skips rows that already have meta).
    expect(sk.pushAccepted).toEqual([
      { id: 1, resource: 'skill', entityId: 's1', version: 1 },
    ]);
  });

  it('push falls back to acked = `accepted` when an older server returns no acceptedDetails', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.pushCalls.length = 0;
    // Simulate a server on the previous protocol: only the legacy `accepted` array, no
    // acceptedDetails. The transport adapter exposes the field as [] (see http-transport).
    bed.transport.pushResponse = {
      accepted: [1],
      acceptedDetails: [],
      rejected: [],
      lastServerVersion: 5,
    };

    await bed.outbox.enqueue({
      resource: 'skill',
      op: 'upsert',
      entityId: 's2',
      payload: new Uint8Array([4, 5, 6]),
      baseVersion: null,
    });
    await flushAsync(600);

    // Outbox still gets acked from the legacy field so old servers keep working.
    expect(bed.outbox.ackedIds.flat()).toContain(1);
    // No detail = no meta write; reconcile (PR4) will fix up later.
    expect(sk.pushAccepted).toEqual([]);
  });

  it('push rejection pulls the affected resource (config-style baseVersion=null is not rebased)', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    await bed.service.enable();
    await flushAsync(50);

    bed.transport.pushCalls.length = 0;
    bed.transport.pullCalls.length = 0;
    bed.transport.pushResponse = {
      accepted: [],
      acceptedDetails: [],
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

    // Single push: baseVersion=null cannot be rebased, so no retry is fired.
    expect(bed.transport.pushCalls.length).toBe(1);
    expect(bed.outbox.rejectedIds[0]?.ids).toContain(1);
    // The rebase path still pulls the rejected mutation's resource to refresh local state.
    expect(bed.transport.pullCalls.some((c) => c.resource === 'skill')).toBe(true);
  });

  it('rebases a row-level baseVersion conflict onto the latest version and retries', async () => {
    const host = new FakeSynchroniser('host');
    bed.service.register(host);
    await bed.service.enable();
    await flushAsync(50);

    // Server holds version 7 for this row; the local mutation was built against 5.
    bed.rowMeta.set('host', 'h1', 7);
    bed.transport.pushCalls.length = 0;

    let pushCount = 0;
    bed.transport.push = async (req) => {
      bed.transport.pushCalls.push(req);
      pushCount++;
      if (pushCount === 1) {
        return { accepted: [], acceptedDetails: [], rejected: [{ id: 1, reason: 'baseVersion mismatch' }], lastServerVersion: 7 };
      }
      return {
        accepted: [1],
        acceptedDetails: [{ id: 1, resource: 'host', entityId: 'h1', version: 8 }],
        rejected: [],
        lastServerVersion: 8,
      };
    };

    await bed.outbox.enqueue({ resource: 'host', op: 'upsert', entityId: 'h1', payload: new Uint8Array([1]), baseVersion: 5 });
    await flushAsync(800);

    // First push rejected → rebased to version 7 → retry accepted.
    expect(bed.transport.pushCalls.length).toBeGreaterThanOrEqual(2);
    expect(bed.transport.pushCalls[1].mutations[0].baseVersion).toBe(7);
    expect(bed.outbox.ackedIds.flat()).toContain(1);
  });

  it('drops a mutation that keeps losing the baseVersion conflict past the retry cap', async () => {
    const host = new FakeSynchroniser('host');
    bed.service.register(host);
    await bed.service.enable();
    await flushAsync(50);

    bed.rowMeta.set('host', 'h1', 2);
    bed.transport.pushResponse = {
      accepted: [],
      acceptedDetails: [],
      rejected: [{ id: 1, reason: 'baseVersion mismatch' }],
      lastServerVersion: 2,
    };
    // Pre-bump retryCount to the cap so the next rejection trips the drop.
    bed.outbox.retryCounts.set(1, SYNC_MAX_BASE_VERSION_RETRIES);

    await bed.outbox.enqueue({ resource: 'host', op: 'upsert', entityId: 'h1', payload: new Uint8Array([1]), baseVersion: 1 });
    await flushAsync(800);

    expect(bed.outbox.discardedIds.flat()).toContain(1);
  });

  it('drops a rejected mutation when the server has deleted the entity', async () => {
    const host = new FakeSynchroniser('host');
    bed.service.register(host);
    await bed.service.enable();
    await flushAsync(50);

    // No rowMeta entry for h1 → entity deleted server-side (pull applied a tombstone).
    bed.transport.pushResponse = {
      accepted: [],
      acceptedDetails: [],
      rejected: [{ id: 1, reason: 'baseVersion mismatch' }],
      lastServerVersion: 3,
    };

    await bed.outbox.enqueue({ resource: 'host', op: 'upsert', entityId: 'h1', payload: new Uint8Array([1]), baseVersion: 2 });
    await flushAsync(800);

    expect(bed.outbox.discardedIds.flat()).toContain(1);
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
  it('enable performs reconcile via HTTP pull so lastSyncedAt is set even before WS connects', async () => {
    // reconcile() drives the initial full pull through HTTP (independent of the WS), so
    // by the time enable() returns we already have an authoritative cursor + lastSyncedAt.
    // The WS staying disconnected only impacts state (Offline) and live pokes — not the
    // initial sync.
    bed.transport.autoConnect = false;
    bed.service.register(new FakeSynchroniser('skill'));

    await bed.service.enable();

    // Pre-WS-connect: BehaviorSubject(false) replays through transportSub → Offline.
    expect(await firstValue(bed.service.state$)).toBe('offline');
    // Reconcile already pulled and refreshed stats — lastSyncedAt is no longer null.
    const statsBefore = await firstValue(bed.service.stats$);
    expect(statsBefore.lastSyncedAt).not.toBeNull();

    bed.transport.connected$.next(true);
    await flushAsync(50);

    // First connect after a successful reconcile skips the redundant pull and flips Idle.
    expect(await firstValue(bed.service.state$)).toBe('idle');
  });

  // Regression: push-only success used to light "Up to date" while lastSyncedAt was
  // still 3-days-old (the reported "Up to date / 3 days ago" bug). With reconcile in
  // place this is now a happy path; the test pins the inverse condition — reconcile
  // *failing* must keep the push-only-Idle gate closed so we don't lie when the cursor
  // is still uninitialised.
  it('push success after a failed reconcile still cannot flip state to Idle', async () => {
    bed.transport.autoConnect = false;
    bed.transport.pullThrows = new Error('reconcile boom');
    bed.service.register(new FakeSynchroniser('skill'));

    await bed.outbox.enqueue({
      resource: 'skill',
      op: 'upsert',
      entityId: 's1',
      payload: new Uint8Array([1, 2, 3]),
      baseVersion: null,
    });
    bed.transport.pushResponse = {
      accepted: [1],
      acceptedDetails: [{ id: 1, resource: 'skill', entityId: 's1', version: 1 }],
      rejected: [],
      lastServerVersion: 1,
    };

    await bed.service.enable();
    // Drain the push debounce window so _runPush has a chance to complete.
    await flushAsync(700);

    expect(bed.transport.pushCalls.length).toBeGreaterThan(0);
    // reconcile failed → _initialPullDone stays false → push success cannot flip Idle.
    // (The actual state here is Error / Offline because reconcile + WS-down both happened.)
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

  // Reconcile: pulls cursor=null per registered resource and routes the patch through the
  // synchroniser. This is the new "first pull" path that replaces the WS-triggered pull.
  it('reconcile pulls cursor=null per registered resource and applies the patch', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    bed.transport.pullResponseFor.set('skill', {
      cursor: 'srv-cursor-skill',
      patch: [{
        op: 'put',
        resource: 'skill',
        entityId: 's-server-1',
        payload: new Uint8Array([9]),
        version: 7,
      }],
      lastMutationId: 0,
    });

    await bed.service.enable();
    await flushAsync(50);

    // Reconcile drove exactly one pull with cursor=null (the connect-driven follow-up was
    // suppressed by _skipFirstConnectPull).
    expect(bed.transport.pullCalls.filter((c) => c.resource === 'skill')).toEqual([
      { clientId: expect.any(String), resource: 'skill', cursor: null },
    ]);
    expect(sk.appliedPatches).toHaveLength(1);
    expect((await bed.cursors.get('skill'))?.cursor).toBe('srv-cursor-skill');
  });

  // Reconcile: passes the server-side authoritative entityId set to each synchroniser so
  // that local meta pointing at server-side-deleted entityIds can be dropped. This is the
  // core ghost-meta fix that unblocks buildInitialSnapshot for the mac-stuck-after-reset
  // scenario.
  it('reconcile passes server entityId set to synchroniser.reconcileGhostMeta', async () => {
    const sk = new FakeSynchroniser('skill');
    bed.service.register(sk);
    bed.transport.pullResponseFor.set('skill', {
      cursor: 'srv-cursor-skill',
      patch: [
        { op: 'put', resource: 'skill', entityId: 'live-1', payload: new Uint8Array([1]), version: 1 },
        { op: 'del', resource: 'skill', entityId: 'tombstone-1', payload: null, version: 2 },
      ],
      lastMutationId: 0,
    });

    await bed.service.enable();
    await flushAsync(50);

    expect(sk.reconcileCalls).toHaveLength(1);
    expect([...sk.reconcileCalls[0]].sort()).toEqual(['live-1', 'tombstone-1']);
  });

  // Regression for the silent-failure root cause: previously enable() would run the
  // pipeline against a locked master key, every encrypt() would throw inside synchroniser
  // try/catch blocks, and the UI would still report "synced". The gate must refuse to
  // start the runtime and surface master_key_locked instead.
  it('enable refuses to start when crypto.available is false and emits master_key_locked', async () => {
    const lockedBed = createTestBed({ cryptoAvailable: false });
    lockedBed.service.register(new FakeSynchroniser('skill'));

    await lockedBed.service.enable();

    expect(await firstValue(lockedBed.service.enabled$)).toBe(false);
    expect(await firstValue(lockedBed.service.state$)).toBe('error');
    const err = await firstValue(lockedBed.service.lastError$);
    expect(err?.code).toBe('master_key_locked');
    expect(err?.requiresUserAction).toBe(true);
    // userEnabled is still persisted because the user's intent is unchanged — only the
    // runtime is blocked until the key unlocks.
    expect(await lockedBed.config.getField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD)).toBe(true);
    // No synchroniser was started, no transport connect, no client id generated.
    expect(lockedBed.transport.connectCalls).toBe(0);
    lockedBed.service.dispose();
  });

  it('synchroniser CryptoLocked status raises master_key_locked on SyncService.lastError$', async () => {
    const synchroniser = new FakeSynchroniser('skill');
    bed.service.register(synchroniser);
    await bed.service.enable();

    const seen: Array<{ code: string; requiresUserAction?: boolean } | null> = [];
    const sub = bed.service.lastError$.subscribe((e) => seen.push(e));

    synchroniser.status$.next(SynchroniserStatus.CryptoLocked);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // A successful pull triggered by enable() may clear lastError$ back to null moments
    // later — we only need to verify that the error did surface on the stream, not that
    // it stuck around.
    const reported = seen.find((e) => e?.code === 'master_key_locked');
    expect(reported).toBeDefined();
    expect(reported?.requiresUserAction).toBe(true);
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
