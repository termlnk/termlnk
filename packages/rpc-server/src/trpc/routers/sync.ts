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

import type { Injector } from '@termlnk/core';
import type { ISyncError, ISyncService, ISyncStats, SyncState } from '@termlnk/sync';
import { Quantity } from '@termlnk/core';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { ISyncService as ISyncServiceId } from '@termlnk/sync';
import { firstValueFrom } from 'rxjs';
import { publicProcedure, router } from '../trpc';

/**
 * 取主进程 ISyncService。SyncCorePlugin 总是注册——但若未来某种 build 没有 sync-core，
 * Quantity.OPTIONAL 让 RPC 调用方拿到明确的"sync 未配置"信号。
 */
function requireSyncService(injector: Injector): ISyncService {
  const service = injector.get(ISyncServiceId, Quantity.OPTIONAL);
  if (!service) {
    throw new Error('sync service is not configured (SyncCorePlugin missing)');
  }
  return service;
}

/**
 * 同步引擎渲染端入口。
 *
 * 主进程拥有真正的 SyncService 实例；渲染端的 SyncClientService 通过本路由
 * 镜像状态流（state$ / stats$ / lastError$ / enabled$）+ 转发命令（enable / disable
 * / syncNow / forceFullResync）。
 *
 * **不暴露**：
 * - register / dispose / 内部触发器——这些是 SyncService 内部接口
 * - clientId / cursor / outbox payload——这些是同步引擎细节，渲染端 UI 不需要
 *
 * 初始 snapshot：渲染端启动时调 `getSnapshot` 拿一份当前快照，避免等待 subscription
 * 首次推送的轻微延迟（与 auth.getCurrentUser 同思路）。
 */
export const syncRouter = router({
  /** 渲染端启动时的初始 snapshot；subscription 后续会推送变更。 */
  getSnapshot: publicProcedure.query(async ({ ctx }): Promise<ISyncSnapshot> => {
    const service = ctx.injector.get(ISyncServiceId, Quantity.OPTIONAL);
    if (!service) {
      return null;
    }
    // BehaviorSubject 持有当前值——firstValueFrom 取一次即可
    const state = await firstValueFrom(service.state$);
    const stats = await firstValueFrom(service.stats$);
    const lastError = await firstValueFrom(service.lastError$);
    const enabled = await firstValueFrom(service.enabled$);
    return { state, stats, lastError, enabled };
  }),

  enable: publicProcedure.mutation(async ({ ctx }) => {
    const service = requireSyncService(ctx.injector);
    await service.enable();
  }),

  disable: publicProcedure.mutation(async ({ ctx }) => {
    const service = requireSyncService(ctx.injector);
    await service.disable();
  }),

  syncNow: publicProcedure.mutation(async ({ ctx }) => {
    const service = requireSyncService(ctx.injector);
    await service.syncNow();
  }),

  forceFullResync: publicProcedure.mutation(async ({ ctx }) => {
    const service = requireSyncService(ctx.injector);
    await service.forceFullResync();
  }),

  state$: publicProcedure.subscription(async function* ({ ctx }) {
    const service = requireSyncService(ctx.injector);
    yield* observableToAsyncGenerator(service.state$);
  }),

  stats$: publicProcedure.subscription(async function* ({ ctx }) {
    const service = requireSyncService(ctx.injector);
    yield* observableToAsyncGenerator(service.stats$);
  }),

  lastError$: publicProcedure.subscription(async function* ({ ctx }) {
    const service = requireSyncService(ctx.injector);
    yield* observableToAsyncGenerator(service.lastError$);
  }),

  enabled$: publicProcedure.subscription(async function* ({ ctx }) {
    const service = requireSyncService(ctx.injector);
    yield* observableToAsyncGenerator(service.enabled$);
  }),
});

export type SyncRouter = typeof syncRouter;

export type ISyncSnapshot = {
  state: SyncState;
  stats: ISyncStats;
  lastError: ISyncError | null;
  enabled: boolean;
} | null;
