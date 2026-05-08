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

import type { IDisposable } from '@termlnk/core';
import type { IResourceSynchroniser, IResourceSyncStats, ISyncError, ISyncOutboxService, ISyncService, ISyncStats, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, generateRandomId, ILogService, Inject, toDisposable } from '@termlnk/core';
import { ConfigRepository, SyncCursorRepository } from '@termlnk/database';
import { ISyncOutboxService as ISyncOutboxServiceId, ISyncTransportService as ISyncTransportServiceId, SYNC_PLUGIN_CONFIG_KEY, SYNC_RESOURCES, SYNC_TRIGGER_INTERVALS, SynchroniserStatus, SyncState } from '@termlnk/sync';
import { BehaviorSubject, debounceTime, filter, interval, merge, Subject, Subscription } from 'rxjs';

const CLIENT_ID_FIELD = 'clientId';

/**
 * 同步引擎主协调器（**仅主进程**）。
 *
 * 职责：
 * - 注册 ResourceSynchroniser，跨它们协调 push/pull/poke 节奏
 * - 在 enable / disable 间维护生命周期；保证启用前 master key 已 unlocked + transport 已就绪
 * - 暴露面向用户 UI 的状态流（state$ / stats$ / lastError$）
 *
 * 节奏（cloud-sync-architecture.md §4.6 触发策略表）：
 * - 本地变更 → outbox.pendingCount$ 增加 → debounce 500ms → push
 * - 收到 poke → debounce 200ms → pull
 * - 每 5 min 兜底 polling pull（防 WS 静默断连）
 * - syncNow() 是用户手动触发的立刻 push + pull
 *
 * 不做的事：
 * - 不直接处理加密 / 解密（synchroniser 自行用 ISyncCryptoService）
 * - 不写本地业务表（synchroniser 通过 Repository 完成）
 * - 不管 token / 网络重连（ISyncTransportService 实现负责）
 *
 * 注册模式：synchronisers 通过 `register()` 在 Plugin onReady / onSteady 时挂入；
 * 接口 ISyncService 不暴露 register（外部 RPC caller 不应触碰它）。
 */
export class SyncService extends Disposable implements ISyncService {
  private readonly _state$ = new BehaviorSubject<SyncState>(SyncState.Disabled);
  readonly state$: Observable<SyncState> = this._state$.asObservable();

  private readonly _stats$ = new BehaviorSubject<ISyncStats>(this._emptyStats());
  readonly stats$: Observable<ISyncStats> = this._stats$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<ISyncError | null>(null);
  readonly lastError$: Observable<ISyncError | null> = this._lastError$.asObservable();

  private readonly _enabled$ = new BehaviorSubject<boolean>(false);
  readonly enabled$: Observable<boolean> = this._enabled$.asObservable();

  /** Synchroniser 索引：以 resourceId 为主键，便于 applyPatch 路由。 */
  private readonly _synchronisers: Map<SyncResourceId, IResourceSynchroniser> = new Map();

  /** 启用期间的活跃订阅；disable 时 unsubscribe。 */
  private _runtimeSub: Subscription | null = null;
  /** transport.connected 监听（独立于 _runtimeSub，因为 disable 后还要监听重连成功） */
  private _transportSub: Subscription | null = null;

  /** 客户端 ID（per-device）。enable 首次启动时从 config 加载或新建。 */
  private _clientId: string | null = null;

  /** 用于触发 push 的内部信号（手动 syncNow 也走这路） */
  private readonly _pushTrigger$ = new Subject<void>();
  /** 用于触发 pull 的内部信号 */
  private readonly _pullTrigger$ = new Subject<void>();

  constructor(
    @Inject(ISyncOutboxServiceId) private readonly _outbox: ISyncOutboxService,
    @Inject(ISyncTransportServiceId) private readonly _transport: ISyncTransportService,
    @Inject(SyncCursorRepository) private readonly _cursors: SyncCursorRepository,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._runtimeSub?.unsubscribe();
    this._transportSub?.unsubscribe();
    for (const s of this._synchronisers.values()) {
      s.dispose();
    }
    this._synchronisers.clear();
    this._state$.complete();
    this._stats$.complete();
    this._lastError$.complete();
    this._enabled$.complete();
    this._pushTrigger$.complete();
    this._pullTrigger$.complete();
    super.dispose();
  }

  /**
   * 注册一个 synchroniser。返回 IDisposable，调用方可显式取消注册（生产路径下
   * 由插件 dispose 链统一处理；测试也用得上）。
   */
  register(synchroniser: IResourceSynchroniser): IDisposable {
    const existing = this._synchronisers.get(synchroniser.resourceId);
    if (existing) {
      throw new Error(`[SyncService] resource ${synchroniser.resourceId} is already registered`);
    }
    this._synchronisers.set(synchroniser.resourceId, synchroniser);

    return toDisposable(() => {
      this._synchronisers.delete(synchroniser.resourceId);
    });
  }

  async enable(): Promise<void> {
    if (this._enabled$.getValue()) {
      return;
    }
    this._lastError$.next(null);
    this._state$.next(SyncState.Idle);
    this._enabled$.next(true);

    // 启动 synchronisers + 初始化 clientId
    for (const s of this._synchronisers.values()) {
      s.start();
    }
    this._clientId = await this._loadOrCreateClientId();

    // 监听 transport 连接状态——断线 → Offline，回连 → Idle + 立即 pull
    this._transportSub = this._transport.connected$.subscribe((isConnected) => {
      if (!this._enabled$.getValue()) {
        return;
      }
      if (!isConnected) {
        this._state$.next(SyncState.Offline);
        return;
      }
      this._state$.next(SyncState.Idle);
      this._pullTrigger$.next();
    });

    // 先建立 push/pull 触发器订阅（必须先于 connect，否则 connected$ 立即推动的 pull 会丢失）
    this._runtimeSub = new Subscription();
    this._runtimeSub.add(
      this._outbox.pendingCount$.pipe(
        filter((n) => n > 0),
        debounceTime(SYNC_TRIGGER_INTERVALS.pushDebounceMs)
      ).subscribe(() => {
        void this._runPush();
      })
    );
    this._runtimeSub.add(
      this._pushTrigger$.subscribe(() => {
        void this._runPush();
      })
    );
    this._runtimeSub.add(
      merge(
        this._transport.poke$.pipe(debounceTime(SYNC_TRIGGER_INTERVALS.pullDebounceMs)),
        this._pullTrigger$,
        interval(SYNC_TRIGGER_INTERVALS.pollIntervalMs)
      ).subscribe(() => {
        void this._runPull();
      })
    );

    // 建立长连接。失败时只标 Offline、不抛错。
    // 连接成功的首次 pull 由 transportSub 监听 connected$ 翻为 true 后自然触发——
    // 不在这里显式 trigger，否则会和 transportSub 重复发 pull。
    try {
      await this._transport.connect();
    } catch (err) {
      this._logService.warn('[SyncService] transport connect failed:', err);
      this._state$.next(SyncState.Offline);
    }
  }

  async disable(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    this._enabled$.next(false);
    this._runtimeSub?.unsubscribe();
    this._runtimeSub = null;
    this._transportSub?.unsubscribe();
    this._transportSub = null;
    try {
      await this._transport.disconnect();
    } catch (err) {
      this._logService.warn('[SyncService] transport disconnect failed:', err);
    }
    this._state$.next(SyncState.Disabled);
  }

  async syncNow(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    this._pushTrigger$.next();
    this._pullTrigger$.next();
  }

  async forceFullResync(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    // 清空所有 cursor → 下次 pull 自然从头开始
    for (const resource of SYNC_RESOURCES) {
      await this._cursors.delete(resource);
    }
    this._pullTrigger$.next();
  }

  private async _runPush(): Promise<void> {
    if (!this._enabled$.getValue() || !this._clientId) {
      return;
    }
    try {
      this._state$.next(SyncState.Syncing);
      const mutations = await this._outbox.peek();
      if (mutations.length === 0) {
        this._state$.next(SyncState.Idle);
        return;
      }
      const resp = await this._transport.push({ clientId: this._clientId, mutations });
      if (resp.accepted.length > 0) {
        await this._outbox.ack([...resp.accepted]);
      }
      if (resp.rejected.length > 0) {
        const rejectedIds = resp.rejected.map((r) => r.id);
        const reason = resp.rejected.map((r) => `${r.id}:${r.reason}`).join(';');
        await this._outbox.markRejected(rejectedIds, reason);
        // 拒绝通常因 baseVersion 冲突——立即 pull 补齐再让用户重发
        this._pullTrigger$.next();
      }
      this._state$.next(SyncState.Idle);
    } catch (err) {
      this._reportError('network', `push failed: ${(err as Error).message}`);
    } finally {
      await this._refreshStats();
    }
  }

  private async _runPull(): Promise<void> {
    if (!this._enabled$.getValue() || !this._clientId) {
      return;
    }
    try {
      this._state$.next(SyncState.Syncing);
      for (const resource of SYNC_RESOURCES) {
        const synchroniser = this._synchronisers.get(resource);
        if (!synchroniser) {
          continue;
        }
        const cursorRow = await this._cursors.get(resource);
        const resp = await this._transport.pull({
          clientId: this._clientId,
          resource,
          cursor: cursorRow?.cursor ?? null,
        });
        if (resp.patch.length > 0) {
          await synchroniser.applyPatch([...resp.patch]);
        }
        if (resp.lastMutationId > 0) {
          // server 报告它已确认的 mutationId — outbox 已经按 push.accepted 清过了，
          // 但 pull 是兜底渠道（如 push 到一半重启就靠这条恢复一致）
          await this._outbox.ack([resp.lastMutationId]);
        }
        await this._cursors.upsert({
          resource,
          cursor: resp.cursor,
          lastPulledAt: Date.now(),
        });
      }
      this._state$.next(SyncState.Idle);
    } catch (err) {
      this._reportError('network', `pull failed: ${(err as Error).message}`);
    } finally {
      await this._refreshStats();
    }
  }

  private _reportError(code: ISyncError['code'], message: string): void {
    this._logService.error(`[SyncService] ${code}: ${message}`);
    this._lastError$.next({ code, message });
    this._state$.next(SyncState.Error);
  }

  private async _refreshStats(): Promise<void> {
    const perResource = {} as Record<SyncResourceId, IResourceSyncStats>;
    let pendingTotal = 0;
    let latestSyncedAt: number | null = null;

    for (const resource of SYNC_RESOURCES) {
      const cursor = await this._cursors.get(resource);
      const pending = await this._outbox.countByResource(resource);
      pendingTotal += pending;
      const syncer = this._synchronisers.get(resource);
      perResource[resource] = {
        status: syncer ? SynchroniserStatus.Idle : SynchroniserStatus.Idle,
        pendingCount: pending,
        lastSyncedAt: cursor?.lastPulledAt ?? null,
        cursor: cursor?.cursor ?? null,
      };
      if (cursor && (latestSyncedAt === null || cursor.lastPulledAt > latestSyncedAt)) {
        latestSyncedAt = cursor.lastPulledAt;
      }
    }

    this._stats$.next({
      pendingMutations: pendingTotal,
      lastSyncedAt: latestSyncedAt,
      perResource,
    });
  }

  private _emptyStats(): ISyncStats {
    const perResource = {} as Record<SyncResourceId, IResourceSyncStats>;
    for (const resource of SYNC_RESOURCES) {
      perResource[resource] = {
        status: SynchroniserStatus.Idle,
        pendingCount: 0,
        lastSyncedAt: null,
        cursor: null,
      };
    }
    return {
      pendingMutations: 0,
      lastSyncedAt: null,
      perResource,
    };
  }

  private async _loadOrCreateClientId(): Promise<string> {
    const existing = await this._configRepo.getField<string>(SYNC_PLUGIN_CONFIG_KEY, CLIENT_ID_FIELD);
    if (existing) {
      return existing;
    }
    const fresh = generateRandomId(24);
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, CLIENT_ID_FIELD, fresh);
    return fresh;
  }
}
