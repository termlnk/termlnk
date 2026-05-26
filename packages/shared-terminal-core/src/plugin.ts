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
import type { ISharedTerminalCoreConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ICollabInviteTransportService, IDaemonKeypairService, IDevicePairingService, IFrameCodecService, IPairingService, IParticipantService, IPtyMultiplexerService, IShareDaemonService, ISharedTerminalCryptoService, ISharedTerminalTransportService, SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { defaultPluginConfig, SHARED_TERMINAL_CORE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { CompositeTransportService } from './services/composite-transport.service';
import { SharedTerminalCryptoService } from './services/crypto.service';
import { DaemonKeypairService } from './services/daemon-keypair.service';
import { DevicePairingService } from './services/device-pairing.service';
import { DriverArbitrationService } from './services/driver-arbitration.service';
import { FrameCodecService } from './services/frame-codec.service';
import { HttpCollabInviteTransportService } from './services/http-collab-invite-transport.service';
import { PairingService } from './services/pairing.service';
import { ParticipantClientService } from './services/participant-client.service';
import { PtyMultiplexerService } from './services/pty-multiplexer.service';
import { RelayTransportService } from './services/relay-transport.service';
import { SessionKeyService } from './services/session-key.service';
import { ShareDaemonService } from './services/share-daemon.service';
import { WebRTCTransportService } from './services/webrtc-transport.service';

export const SHARED_TERMINAL_CORE_PLUGIN_NAME = 'SHARED_TERMINAL_CORE_PLUGIN';

@DependentOn(SharedTerminalPlugin)
export class SharedTerminalCorePlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ISharedTerminalCoreConfig> = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(SHARED_TERMINAL_CORE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [ISharedTerminalCryptoService],
      [IFrameCodecService],
      [IDaemonKeypairService],
      [DriverArbitrationService],
      [SessionKeyService],
      [IPtyMultiplexerService],
      [IShareDaemonService],
      [IPairingService],
      [ISharedTerminalTransportService],
      [IParticipantService],
      [IDevicePairingService],
    ]);
  }

  private _initDependencies() {
    const dependencies: Dependency[] = [
      [ISharedTerminalCryptoService, { useClass: SharedTerminalCryptoService }],
      [IFrameCodecService, { useClass: FrameCodecService }],
      [IDaemonKeypairService, { useClass: DaemonKeypairService }],
      [DriverArbitrationService, { useClass: DriverArbitrationService }],
      [SessionKeyService, { useClass: SessionKeyService }],
      [IPtyMultiplexerService, { useClass: PtyMultiplexerService }],
      [IShareDaemonService, { useClass: ShareDaemonService }],
      [IPairingService, { useClass: PairingService }],
      [WebRTCTransportService, { useClass: WebRTCTransportService }],
      [RelayTransportService, { useClass: RelayTransportService }],
      [ISharedTerminalTransportService, { useClass: CompositeTransportService }],
      [IParticipantService, { useClass: ParticipantClientService }],
      [IDevicePairingService, { useClass: DevicePairingService }],
      [ICollabInviteTransportService, { useClass: HttpCollabInviteTransportService }],
    ];

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
