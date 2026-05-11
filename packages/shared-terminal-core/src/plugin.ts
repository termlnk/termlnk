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
import type {
  ISharedTerminalPluginConfig,
} from '@termlnk/shared-terminal';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IFrameCodecService, IPairingService, IPtyMultiplexerService, ISharedSessionRecordingService, ISharedTerminalCryptoService, ISharedTerminalTransportService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { SHARED_TERMINAL_CORE_PLUGIN_NAME } from './common/constants';
import { SharedTerminalCryptoService } from './services/crypto.service';
import { FrameCodecService } from './services/frame-codec.service';
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
    const dependencies: Dependency[] = [
      [ISharedTerminalCryptoService, { useClass: SharedTerminalCryptoService }],
      [IFrameCodecService, { useClass: FrameCodecService }],
      [IPtyMultiplexerService, { useClass: PtyMultiplexerService }],
      [IPairingService, { useClass: PairingService }],
      [ISharedTerminalTransportService, { useClass: RelayTransportService }],
      [ISharedSessionRecordingService, { useClass: SharedSessionRecordingService }],
    ];

    const merged = mergeOverrideWithDependencies(dependencies, this._mergedConfig().override);
    registerDependencies(this._injector, merged);
    touchDependencies(this._injector, [
      [ISharedTerminalCryptoService],
      [IFrameCodecService],
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
