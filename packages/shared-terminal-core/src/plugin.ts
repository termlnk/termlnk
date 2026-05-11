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

import type { Dependency } from '@termlnk/core';
import type { ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
// Deep import: avoid dragging the AuthCorePlugin transitive graph (which pulls
// better-sqlite3) into renderer / web bundles. TokenManager is what the HTTP
// transports need at runtime — same singleton SyncCorePlugin already binds.
import { TokenManager } from '@termlnk/auth-core/services/token-manager.service.ts';
import { DependentOn, IConfigService, ILogService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ICollabInviteTransportService, IDaemonKeypairService, IFrameCodecService, IPairingService, IPtyMultiplexerService, ISharedSessionRecordingService, ISharedTerminalCryptoService, ISharedTerminalTransportService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { SHARED_TERMINAL_CORE_PLUGIN_NAME } from './common/constants';
import { SharedTerminalCryptoService } from './services/crypto.service';
import { DaemonKeypairService } from './services/daemon-keypair.service';
import { FrameCodecService } from './services/frame-codec.service';
import { HttpCollabInviteTransportService } from './services/http-collab-invite-transport.service';
import { PairingService } from './services/pairing.service';
import { PtyMultiplexerService } from './services/pty-multiplexer.service';
import { SharedSessionRecordingService } from './services/recording.service';
import { RelayTransportService } from './services/relay-transport.service';

@DependentOn(SharedTerminalPlugin)
export class SharedTerminalCorePlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_CORE_PLUGIN_NAME;

  constructor(
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._configService.setConfig(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY,
      this._mergedConfig()
    );
  }

  override onStarting(): void {
    super.onStarting();
    const config = this._mergedConfig();
    const dependencies: Dependency[] = [
      [ISharedTerminalCryptoService, { useClass: SharedTerminalCryptoService }],
      [IFrameCodecService, { useClass: FrameCodecService }],
      [IDaemonKeypairService, { useClass: DaemonKeypairService }],
      [IPtyMultiplexerService, { useClass: PtyMultiplexerService }],
      [IPairingService, { useClass: PairingService }],
      [ISharedTerminalTransportService, { useClass: RelayTransportService }],
      [ISharedSessionRecordingService, { useClass: SharedSessionRecordingService }],
    ];

    // Conditional HTTP transport for owner-side invite lifecycle mirroring (P5.5.2).
    // Uses the same TokenManager singleton that SyncCorePlugin binds (AuthCorePlugin).
    if (config.cloudBaseUrl) {
      const cloudBaseUrl = config.cloudBaseUrl;
      dependencies.push([ICollabInviteTransportService, {
        useFactory: (tokenManager: TokenManager, logService: ILogService) =>
          new HttpCollabInviteTransportService({ baseUrl: cloudBaseUrl }, tokenManager, logService),
        deps: [TokenManager, ILogService],
      }]);
    }

    const merged = mergeOverrideWithDependencies(dependencies, config.override);
    registerDependencies(this._injector, merged);
    touchDependencies(this._injector, [
      [ISharedTerminalCryptoService],
      [IFrameCodecService],
      [IDaemonKeypairService],
      [IPtyMultiplexerService],
      [IPairingService],
      [ISharedTerminalTransportService],
      [ISharedSessionRecordingService],
    ]);
  }

  private _mergedConfig(): ISharedTerminalPluginConfig {
    const current = this._configService.getConfig<ISharedTerminalPluginConfig>(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY
    );
    return merge({}, current ?? {});
  }
}
