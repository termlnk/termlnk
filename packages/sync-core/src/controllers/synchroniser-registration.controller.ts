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

import type { IResourceSynchroniser, ISyncPluginConfig, SyncResourceId } from '@termlnk/sync';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ISyncService, SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { ConfigSynchroniser } from '../synchronisers/config-synchroniser';
import { HostSynchroniser } from '../synchronisers/host-synchroniser';
import { McpSynchroniser } from '../synchronisers/mcp-synchroniser';
import { ProviderSynchroniser } from '../synchronisers/provider-synchroniser';
import { SkillSynchroniser } from '../synchronisers/skill-synchroniser';

// Registers synchronisers at onReady (plugin onStarting is too early — dependencies
// are not yet constructed). Synchroniser construction is side-effect free; start()
// subscribes to Repository.changed$, so filtering here keeps excluded resources from
// ever pushing into the outbox.
export class SynchroniserRegistrationController extends Disposable {
  constructor(
    @ISyncService private readonly _syncService: ISyncService,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ILogService) private readonly _logService: ILogService,
    @Inject(HostSynchroniser) private readonly _host: HostSynchroniser,
    @Inject(ConfigSynchroniser) private readonly _config: ConfigSynchroniser,
    @Inject(ProviderSynchroniser) private readonly _provider: ProviderSynchroniser,
    @Inject(McpSynchroniser) private readonly _mcp: McpSynchroniser,
    @Inject(SkillSynchroniser) private readonly _skill: SkillSynchroniser
  ) {
    super();

    const excluded = this._readExcludedResources();
    const candidates: ReadonlyArray<readonly [SyncResourceId, IResourceSynchroniser]> = [
      ['host', this._host],
      ['config', this._config],
      ['ai_provider', this._provider],
      ['mcp_server', this._mcp],
      ['skill', this._skill],
    ];

    for (const [resourceId, synchroniser] of candidates) {
      if (excluded.has(resourceId)) {
        this._logService.log(`[SynchroniserRegistrationController] skipping ${resourceId} (excluded by config)`);
        continue;
      }
      this.disposeWithMe(this._syncService.register(synchroniser));
    }
  }

  private _readExcludedResources(): ReadonlySet<SyncResourceId> {
    const config = this._configService.getConfig<ISyncPluginConfig>(SYNC_PLUGIN_CONFIG_KEY);
    const list = config?.excludedResources ?? [];
    return new Set<SyncResourceId>(list);
  }
}
