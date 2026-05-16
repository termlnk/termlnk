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
 * Resolve the main-process `ISyncService`. `SyncCorePlugin` is always bound
 * today, but `Quantity.OPTIONAL` keeps room for builds that ship without it
 * and lets RPC callers get an explicit "sync not configured" signal.
 */
function requireSyncService(injector: Injector): ISyncService {
  const service = injector.get(ISyncServiceId, Quantity.OPTIONAL);
  if (!service) {
    throw new Error('sync service is not configured (SyncCorePlugin missing)');
  }
  return service;
}

/**
 * Renderer-facing entry point for the sync engine.
 *
 * The real `SyncService` lives in the main process; the renderer's
 * `SyncClientService` mirrors state streams (`state$` / `stats$` /
 * `lastError$` / `enabled$`) and forwards commands (`enable` / `disable` /
 * `syncNow` / `forceFullResync`) through this router.
 *
 * Not exposed:
 * - `register` / `dispose` / internal triggers — `SyncService`'s private API.
 * - `clientId` / `cursor` / outbox payloads — engine internals the UI does
 *   not need.
 *
 * Initial snapshot: on startup the renderer calls `getSnapshot` to grab the
 * current state and avoid the small delay before the first subscription push
 * (same approach as `auth.getCurrentUser`).
 */
export const syncRouter = router({
  /** Initial snapshot returned to the renderer on startup; subscriptions push subsequent changes. */
  getSnapshot: publicProcedure.query(async ({ ctx }): Promise<ISyncSnapshot> => {
    const service = ctx.injector.get(ISyncServiceId, Quantity.OPTIONAL);
    if (!service) {
      return null;
    }
    // The BehaviorSubject already holds the current value — a single `firstValueFrom` is enough.
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
