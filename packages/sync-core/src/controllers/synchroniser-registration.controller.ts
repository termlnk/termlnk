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
import { SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { SyncService } from '../services/sync.service';
import { ConfigSynchroniser } from '../synchronisers/config-synchroniser';
import { HostSynchroniser } from '../synchronisers/host-synchroniser';
import { McpSynchroniser } from '../synchronisers/mcp-synchroniser';
import { ProviderSynchroniser } from '../synchronisers/provider-synchroniser';
import { SkillSynchroniser } from '../synchronisers/skill-synchroniser';

/**
 * 启动时把可用 synchroniser 注册到 SyncService。
 *
 * 通过 controller 而非 Plugin 直接注册——controller 在 onReady 阶段被 touch，
 * 此时所有依赖都已 ready；Plugin 的 onStarting 阶段服务还没构造。
 *
 * Synchroniser 的 `start()` 才会订阅 Repository.changed$；构造本身没有副作用。
 * 因此过滤可以发生在 register 这一步——被排除的 synchroniser 永远拿不到 start 调用，
 * 不订阅本地变更，也就不会往 outbox 灌东西。
 *
 * 排除来源：`ISyncPluginConfig.excludedResources`（用户偏好；默认空数组）。
 * chat / terminal_session_backup / mcp_oauth_token 这些**架构层面**的非同步资源
 * 根本就没有 synchroniser，与本字段无关。
 */
export class SynchroniserRegistrationController extends Disposable {
  constructor(
    @Inject(SyncService) private readonly _syncService: SyncService,
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
