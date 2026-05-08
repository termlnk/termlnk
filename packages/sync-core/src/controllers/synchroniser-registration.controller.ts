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

import { Disposable, Inject } from '@termlnk/core';
import { SyncService } from '../services/sync.service';
import { ConfigSynchroniser } from '../synchronisers/config-synchroniser';
import { HostSynchroniser } from '../synchronisers/host-synchroniser';
import { McpSynchroniser } from '../synchronisers/mcp-synchroniser';
import { ProviderSynchroniser } from '../synchronisers/provider-synchroniser';
import { SkillSynchroniser } from '../synchronisers/skill-synchroniser';

/**
 * 启动时自动把 5 个 synchroniser 注册到 SyncService。
 *
 * 通过 controller 而非 Plugin 直接注册——controller 在 onReady 阶段被 touch，
 * 此时所有依赖都已 ready；Plugin 的 onStarting 阶段服务还没构造。
 *
 * 注册的副作用：每个 synchroniser 在自己的构造里订阅对应 Repository.changed$，
 * 因此即使 SyncService.enable() 还没被调用，本地变更也会立即被捕获、加密、入 outbox。
 * 这让 outbox 起到了"存盘 + 待机"的作用——用户登录后再 enable() 就能立即同步。
 */
export class SynchroniserRegistrationController extends Disposable {
  constructor(
    @Inject(SyncService) private readonly _syncService: SyncService,
    @Inject(HostSynchroniser) private readonly _host: HostSynchroniser,
    @Inject(ConfigSynchroniser) private readonly _config: ConfigSynchroniser,
    @Inject(ProviderSynchroniser) private readonly _provider: ProviderSynchroniser,
    @Inject(McpSynchroniser) private readonly _mcp: McpSynchroniser,
    @Inject(SkillSynchroniser) private readonly _skill: SkillSynchroniser
  ) {
    super();

    this.disposeWithMe(this._syncService.register(this._host));
    this.disposeWithMe(this._syncService.register(this._config));
    this.disposeWithMe(this._syncService.register(this._provider));
    this.disposeWithMe(this._syncService.register(this._mcp));
    this.disposeWithMe(this._syncService.register(this._skill));
  }
}
