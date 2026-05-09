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

import type { IResourceSyncStats, ISyncError, ISyncService, ISyncStats, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Inject, toDisposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { SYNC_RESOURCES, SynchroniserStatus, SyncState } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * 渲染端 ISyncService 实现——通过 tRPC 与主进程的 SyncService 通信。
 *
 * 状态镜像：
 * - 构造时拉一次 getSnapshot 兜底，避免 BehaviorSubject 初始值短暂闪烁
 * - 启动 4 条 subscription（state$ / stats$ / lastError$ / enabled$），把主进程
 *   的状态实时镜像到本地 BehaviorSubject
 * - dispose 时取消订阅 + complete BehaviorSubject
 *
 * 命令转发：enable / disable / syncNow / forceFullResync 直接 mutate；不缓存任何状态。
 *
 * 错误语义：subscription 通道异常 → 记日志保持上一次值；mutation 异常 → 上抛给调用方。
 */
export class SyncClientService extends Disposable implements ISyncService {
  private readonly _state$ = new BehaviorSubject<SyncState>(SyncState.Disabled);
  readonly state$: Observable<SyncState> = this._state$.asObservable();

  private readonly _stats$ = new BehaviorSubject<ISyncStats>(emptyStats());
  readonly stats$: Observable<ISyncStats> = this._stats$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<ISyncError | null>(null);
  readonly lastError$: Observable<ISyncError | null> = this._lastError$.asObservable();

  private readonly _enabled$ = new BehaviorSubject<boolean>(false);
  readonly enabled$: Observable<boolean> = this._enabled$.asObservable();

  constructor(
    @Inject(IRPCClientService) private readonly _rpcClientService: IRPCClientService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();

    // 兜底初始 snapshot——失败（云未配置）时静默
    void this._client.getSnapshot.query()
      .then((snapshot) => {
        if (!snapshot) {
          return;
        }
        this._state$.next(snapshot.state);
        this._stats$.next(snapshot.stats);
        this._lastError$.next(snapshot.lastError);
        this._enabled$.next(snapshot.enabled);
      })
      .catch((err) => {
        this._logService.warn('[SyncClientService] initial getSnapshot failed:', err);
      });

    const stateSub = trpcSubscriptionToObservable<SyncState>(
      (opts) => this._client.state$.subscribe(undefined, opts)
    ).subscribe({
      next: (state) => this._state$.next(state),
      error: (err) => this._logService.warn('[SyncClientService] state$ stream error:', err),
    });

    const statsSub = trpcSubscriptionToObservable<ISyncStats>(
      (opts) => this._client.stats$.subscribe(undefined, opts)
    ).subscribe({
      next: (stats) => this._stats$.next(stats),
      error: (err) => this._logService.warn('[SyncClientService] stats$ stream error:', err),
    });

    const errorSub = trpcSubscriptionToObservable<ISyncError | null>(
      (opts) => this._client.lastError$.subscribe(undefined, opts)
    ).subscribe({
      next: (e) => this._lastError$.next(e),
      error: (err) => this._logService.warn('[SyncClientService] lastError$ stream error:', err),
    });

    const enabledSub = trpcSubscriptionToObservable<boolean>(
      (opts) => this._client.enabled$.subscribe(undefined, opts)
    ).subscribe({
      next: (e) => this._enabled$.next(e),
      error: (err) => this._logService.warn('[SyncClientService] enabled$ stream error:', err),
    });

    this.disposeWithMe(toDisposable(stateSub));
    this.disposeWithMe(toDisposable(statsSub));
    this.disposeWithMe(toDisposable(errorSub));
    this.disposeWithMe(toDisposable(enabledSub));
  }

  override dispose(): void {
    this._state$.complete();
    this._stats$.complete();
    this._lastError$.complete();
    this._enabled$.complete();
    super.dispose();
  }

  private get _client() {
    return this._rpcClientService.getClient().sync;
  }

  async enable(): Promise<void> {
    await this._client.enable.mutate();
  }

  async disable(): Promise<void> {
    await this._client.disable.mutate();
  }

  async syncNow(): Promise<void> {
    await this._client.syncNow.mutate();
  }

  async forceFullResync(): Promise<void> {
    await this._client.forceFullResync.mutate();
  }
}

function emptyStats(): ISyncStats {
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
