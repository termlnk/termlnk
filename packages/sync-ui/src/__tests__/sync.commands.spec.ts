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
import type { IResourceSynchroniser, ISyncError, ISyncStats, SyncState } from '@termlnk/sync';
import { ILogService, Injector, toDisposable } from '@termlnk/core';
import { ISyncService } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DisableSyncCommand, EnableSyncCommand, ForceFullResyncCommand, SyncNowCommand, ToggleSyncEnabledCommand } from '../commands/sync.commands';

class NoopLogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: number): void {}
}

class FakeSyncService implements ISyncService {
  readonly _enabled$ = new BehaviorSubject<boolean>(false);
  readonly state$ = new BehaviorSubject<SyncState>('disabled' as SyncState).asObservable();
  readonly stats$ = new BehaviorSubject<ISyncStats>({ pendingMutations: 0, lastSyncedAt: null, lastPushedAt: null, perResource: {} as never }).asObservable();
  readonly lastError$ = new BehaviorSubject<ISyncError | null>(null).asObservable();
  readonly enabled$ = this._enabled$.asObservable();
  enableCalls = 0;
  disableCalls = 0;
  syncNowCalls = 0;
  forceFullResyncCalls = 0;

  async enable(): Promise<void> {
    this.enableCalls++;
    this._enabled$.next(true);
  }

  async disable(): Promise<void> {
    this.disableCalls++;
    this._enabled$.next(false);
  }

  async syncNow(): Promise<void> {
    this.syncNowCalls++;
  }

  async forceFullResync(): Promise<void> {
    this.forceFullResyncCalls++;
  }

  register(_synchroniser: IResourceSynchroniser): IDisposable {
    return toDisposable(() => {});
  }

  async stopRuntime(): Promise<void> {
    this._enabled$.next(false);
  }
}

function createBed(opts: { withSync: boolean }): { injector: Injector; sync: FakeSyncService | null } {
  const injector = new Injector();
  injector.add([ILogService, { useClass: NoopLogService }]);
  let sync: FakeSyncService | null = null;
  if (opts.withSync) {
    sync = new FakeSyncService();
    injector.add([ISyncService, { useValue: sync }]);
  }
  return { injector, sync };
}

describe('sync.commands', () => {
  it('SyncNowCommand calls ISyncService.syncNow when bound', async () => {
    const bed = createBed({ withSync: true });
    const result = await SyncNowCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.syncNowCalls).toBe(1);
  });

  it('SyncNowCommand returns false when ISyncService is unbound', async () => {
    const bed = createBed({ withSync: false });
    const result = await SyncNowCommand.handler(bed.injector);
    expect(result).toBe(false);
  });

  it('EnableSyncCommand calls ISyncService.enable', async () => {
    const bed = createBed({ withSync: true });
    const result = await EnableSyncCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.enableCalls).toBe(1);
  });

  it('DisableSyncCommand calls ISyncService.disable', async () => {
    const bed = createBed({ withSync: true });
    await EnableSyncCommand.handler(bed.injector);
    const result = await DisableSyncCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.disableCalls).toBe(1);
  });

  it('ToggleSyncEnabledCommand flips disabled→enabled', async () => {
    const bed = createBed({ withSync: true });
    expect(bed.sync!._enabled$.getValue()).toBe(false);
    const result = await ToggleSyncEnabledCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.enableCalls).toBe(1);
    expect(bed.sync!._enabled$.getValue()).toBe(true);
  });

  it('ToggleSyncEnabledCommand flips enabled→disabled', async () => {
    const bed = createBed({ withSync: true });
    await EnableSyncCommand.handler(bed.injector);
    const result = await ToggleSyncEnabledCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.disableCalls).toBe(1);
    expect(bed.sync!._enabled$.getValue()).toBe(false);
  });

  it('ForceFullResyncCommand calls ISyncService.forceFullResync', async () => {
    const bed = createBed({ withSync: true });
    const result = await ForceFullResyncCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.sync!.forceFullResyncCalls).toBe(1);
  });

  it('All commands return false when ISyncService is unbound', async () => {
    const bed = createBed({ withSync: false });
    expect(await EnableSyncCommand.handler(bed.injector)).toBe(false);
    expect(await DisableSyncCommand.handler(bed.injector)).toBe(false);
    expect(await ToggleSyncEnabledCommand.handler(bed.injector)).toBe(false);
    expect(await ForceFullResyncCommand.handler(bed.injector)).toBe(false);
  });
});
