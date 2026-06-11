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

import type { IConfigOptions, IConfigService, IDisposable, ILogService, LogLevel } from '@termlnk/core';
import type { IResourceSynchroniser, ISyncMutation, ISyncPatchItem, SyncResourceId } from '@termlnk/sync';
import type { ConfigSynchroniser, HostSynchroniser, IdentitySynchroniser, KnownHostSynchroniser, McpSynchroniser, ProviderSynchroniser, SkillSynchroniser, SshKeySynchroniser } from '@termlnk/sync-engine';
import type { Observable } from 'rxjs';
import { SYNC_PLUGIN_CONFIG_KEY, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SynchroniserRegistrationController } from '../controllers/synchroniser-registration.controller';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

/**
 * Plain config-bag fake for `IConfigService.getConfig` so we avoid spinning
 * up the real `ConfigService`. The controller only calls `getConfig`; the
 * rest of the interface is implemented as no-ops.
 */
class StubConfigService implements IConfigService {
  readonly configChanged$: Observable<Record<string, unknown>> = EMPTY;
  private readonly _bag = new Map<string, unknown>();

  set(id: string, value: unknown): void {
    this._bag.set(id, value);
  }

  getConfig<T>(id: string, defaultValue?: any): T | null {
    return (this._bag.has(id) ? (this._bag.get(id) as T) : defaultValue) ?? null;
  }

  setConfig(id: string, value: unknown, _options?: IConfigOptions): void {
    this._bag.set(id, value);
  }

  registerConfig(_id: string, _value: unknown, _options?: IConfigOptions): IDisposable {
    return { dispose: () => {} };
  }

  deleteConfig(id: string): boolean {
    return this._bag.delete(id);
  }

  subscribeConfigValue$<T = unknown>(_key: string): Observable<T> {
    return EMPTY as Observable<T>;
  }
}

/** Stand-in `SyncService`: the controller only calls `register`. */
class FakeSyncService {
  registered: SyncResourceId[] = [];

  register(synchroniser: IResourceSynchroniser): IDisposable {
    this.registered.push(synchroniser.resourceId);
    return { dispose: () => {} };
  }
}

class StubSynchroniser implements IResourceSynchroniser {
  readonly status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  startCalls = 0;
  constructor(public readonly resourceId: SyncResourceId) {}
  start(): void {
    this.startCalls++;
  }

  async applyPatch(_patch: ISyncPatchItem[]): Promise<void> {}
  async buildMutations(): Promise<ISyncMutation[]> { return []; }
  async buildInitialSnapshot(): Promise<ISyncMutation[]> { return []; }
  async onPushAccepted(): Promise<void> {}
  async reconcileGhostMeta(): Promise<void> {}
  dispose(): void {}
}

interface ITestBed {
  config: StubConfigService;
  fakeSync: FakeSyncService;
  controller: SynchroniserRegistrationController;
}

function createBed(excluded: SyncResourceId[] | undefined): ITestBed {
  const config = new StubConfigService();
  if (excluded !== undefined) {
    config.set(SYNC_PLUGIN_CONFIG_KEY, { excludedResources: excluded });
  }
  const fakeSync = new FakeSyncService();
  const controller = new SynchroniserRegistrationController(
    fakeSync as unknown as InstanceType<typeof import('@termlnk/sync-engine').SyncService>,
    config,
    new NoopLogService(),
    new StubSynchroniser('host') as unknown as HostSynchroniser,
    new StubSynchroniser('config') as unknown as ConfigSynchroniser,
    new StubSynchroniser('ai_provider') as unknown as ProviderSynchroniser,
    new StubSynchroniser('mcp_server') as unknown as McpSynchroniser,
    new StubSynchroniser('skill') as unknown as SkillSynchroniser,
    new StubSynchroniser('ssh_key') as unknown as SshKeySynchroniser,
    new StubSynchroniser('identity') as unknown as IdentitySynchroniser,
    new StubSynchroniser('known_host') as unknown as KnownHostSynchroniser
  );
  return { config, fakeSync, controller };
}

const ALL_RESOURCES_SORTED: SyncResourceId[] = [
  'ai_provider',
  'config',
  'host',
  'identity',
  'known_host',
  'mcp_server',
  'skill',
  'ssh_key',
];

describe('SynchroniserRegistrationController', () => {
  it('registers all synchronisers when config has no excludedResources', () => {
    const bed = createBed(undefined);
    expect(bed.fakeSync.registered.sort()).toEqual(ALL_RESOURCES_SORTED);
    bed.controller.dispose();
  });

  it('registers all synchronisers when excludedResources is empty', () => {
    const bed = createBed([]);
    expect(bed.fakeSync.registered.sort()).toEqual(ALL_RESOURCES_SORTED);
    bed.controller.dispose();
  });

  it('skips a single excluded synchroniser', () => {
    const bed = createBed(['host']);
    expect(bed.fakeSync.registered.sort()).toEqual([
      'ai_provider', 'config', 'identity', 'known_host', 'mcp_server', 'skill', 'ssh_key',
    ]);
    bed.controller.dispose();
  });

  it('skips multiple excluded synchronisers', () => {
    const bed = createBed(['ai_provider', 'mcp_server', 'skill']);
    expect(bed.fakeSync.registered.sort()).toEqual([
      'config', 'host', 'identity', 'known_host', 'ssh_key',
    ]);
    bed.controller.dispose();
  });

  it('honours an unknown excludedResource entry without crashing (forward compat)', () => {
    const bed = createBed(['nonexistent' as SyncResourceId]);
    expect(bed.fakeSync.registered.sort()).toEqual(ALL_RESOURCES_SORTED);
    bed.controller.dispose();
  });

  it('disposing the controller does not crash even with skipped synchronisers', () => {
    const bed = createBed(['host', 'skill']);
    expect(() => bed.controller.dispose()).not.toThrow();
  });
});
