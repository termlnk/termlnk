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

import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { IBackupService, ISyncCryptoService, ISyncOutboxService, ISyncService, ISyncTransportService, SyncPlugin } from '@termlnk/sync';
import { SynchroniserRegistrationController } from './controllers/synchroniser-registration.controller';
import { BackupService } from './services/backup.service';
import { SyncCryptoService } from './services/crypto.service';
import { NoopSyncTransportService } from './services/noop-transport.service';
import { SyncOutboxService } from './services/outbox.service';
import { SyncService } from './services/sync.service';
import { ConfigSynchroniser } from './synchronisers/config-synchroniser';
import { HostSynchroniser } from './synchronisers/host-synchroniser';
import { McpSynchroniser } from './synchronisers/mcp-synchroniser';
import { ProviderSynchroniser } from './synchronisers/provider-synchroniser';
import { SkillSynchroniser } from './synchronisers/skill-synchroniser';

export const SYNC_CORE_PLUGIN_NAME = 'SYNC_CORE_PLUGIN';

export interface ISyncCorePluginConfig {
  /** Override 列表——desktop main 用它把 NoopSyncTransportService 替换为真实 HTTP/WS 实现。 */
  override?: DependencyOverride;
}

/**
 * Sync Core 插件——主进程实现的注册中心。
 *
 * 依赖：
 * - DatabasePlugin（synchroniser 用 Repository；outbox 用 ConfigRepository 持久化 clientMutId）
 * - AuthCorePlugin（synchroniser 通过 IMasterKeyService 拿 encKey 加密）
 * - SyncPlugin（契约层 config key + DI 标识符）
 *
 * 注册的服务：
 * - ISyncCryptoService → SyncCryptoService
 * - ISyncOutboxService → SyncOutboxService
 * - IBackupService → BackupService（独立可用，不依赖网络）
 * - ISyncService → SyncService
 * - ISyncTransportService → NoopSyncTransportService（占位；Phase 3 通过 override 替换）
 * - 5 synchroniser concrete classes（HostSynchroniser / ConfigSynchroniser / ...）
 *
 * 注册的控制器：
 * - SynchroniserRegistrationController（onReady 把 synchroniser 接入 SyncService）
 *
 * Phase 3 落地清单：
 * - 在 desktop main 的 SyncCorePlugin 配置中 override `ISyncTransportService` 为 HTTP 实现
 * - 在 AuthCorePlugin 配置中 override `ITokenRefresher` 为 HTTP 实现
 * - 触发 IAuthService 注册（含 server SRP 通信）
 */
@DependentOn(DatabasePlugin, AuthCorePlugin, SyncPlugin)
export class SyncCorePlugin extends Plugin {
  static override pluginName = SYNC_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncCorePluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      // 服务
      [ISyncCryptoService, { useClass: SyncCryptoService }],
      [ISyncOutboxService, { useClass: SyncOutboxService }],
      [IBackupService, { useClass: BackupService }],
      [ISyncService, { useClass: SyncService }],
      [ISyncTransportService, { useClass: NoopSyncTransportService }],

      // SyncService 注册路径需要 concrete class binding（DI 通过类型 token 取到的是 ISyncService
      // 接口实现，但 SynchroniserRegistrationController 注入的是具体 SyncService 类——
      // 把同一个实例同时绑给 ISyncService 和 SyncService 两个 token）
      [SyncService, { useClass: SyncService }],

      // 5 个 synchroniser
      [HostSynchroniser, { useClass: HostSynchroniser }],
      [ConfigSynchroniser, { useClass: ConfigSynchroniser }],
      [ProviderSynchroniser, { useClass: ProviderSynchroniser }],
      [McpSynchroniser, { useClass: McpSynchroniser }],
      [SkillSynchroniser, { useClass: SkillSynchroniser }],

      // 注册控制器
      [SynchroniserRegistrationController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    // touch SynchroniserRegistrationController 触发其构造，将 synchroniser 注入 SyncService
    touchDependencies(this._injector, [
      [SynchroniserRegistrationController],
    ]);
  }
}
