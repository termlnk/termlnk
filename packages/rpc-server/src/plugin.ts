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

import type { Dependency, LocaleType } from '@termlnk/core';
import type { IRPCServerConfig } from './controllers/config.schema';
import { ITerminalSessionEnvService, ITerminalSuggestService } from '@termlnk/agent';
import { DependentOn, IConfigService, Inject, Injector, LocaleService, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ConfigRepository, DatabasePlugin } from '@termlnk/database';
import { IFileTransferService, INotifyService, ISSHSessionService, ISSHToolService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { ISharedTerminalService } from '@termlnk/shared-terminal';
import { IPTYSessionService } from '@termlnk/terminal';
import { defaultPluginConfig, RPC_SERVER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { McpToolsController } from './controllers/mcp-tools.controller';
import { TerminalSessionPromptController } from './controllers/terminal-session-prompt.controller';
import { IFileDialogService, NoopFileDialogService } from './services/file-transfer/file-dialog.service';
import { FileTransferService } from './services/file-transfer/file-transfer.service';
import { NotifyService } from './services/notify/notify.service';
import { IProxySocketService, ProxySocketService } from './services/proxy/proxy-socket.service';
import { PTYSessionService } from './services/pty/pty-session.service';
import { ISFTPSessionService, SFTPSessionService } from './services/sftp/sftp-session.service';
import { DeepLinkBus, IDeepLinkBus } from './services/shared-terminal/deep-link.bus';
import { IShareSessionService, ShareSessionService } from './services/shared-terminal/share-session.service';
import { SharedTerminalService } from './services/shared-terminal/shared-terminal.service';
import { CommandBlockService, ICommandBlockService } from './services/shell-integration/command-block.service';
import { TerminalSessionEnvService } from './services/shell-integration/terminal-session-env.service';
import { SSHSessionService } from './services/ssh-session/ssh-session.service';
import { SSHToolService } from './services/ssh-tool.service';
import { ISSHHostChainService, SSHHostChainService } from './services/ssh/ssh-host-chain.service';
import { ISSHSocketService, SSHSocketService } from './services/ssh/ssh-socket.service';
import { TerminalSessionNotifyService } from './services/terminal-session-notify.service';
import { TerminalSuggestService } from './services/terminal-suggest/terminal-suggest.service';

export const RPC_SERVER_PLUGIN_NAME = 'RPC_SERVER_PLUGIN';

@DependentOn(DatabasePlugin)
export class RPCServerPlugin extends Plugin {
  static override pluginName = RPC_SERVER_PLUGIN_NAME;

  constructor(
    private readonly _config: IRPCServerConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(RPC_SERVER_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting() {
    this._initDependencies();
  }

  private _initDependencies() {
    const dependencies: Dependency[] = [
      [IFileDialogService, { useClass: NoopFileDialogService }],
      [IFileTransferService, { useClass: FileTransferService }],
      [INotifyService, { useClass: NotifyService }],
      [IProxySocketService, { useClass: ProxySocketService }],
      [ISSHSocketService, { useClass: SSHSocketService }],
      [ISSHHostChainService, { useClass: SSHHostChainService }],
      [ISSHSessionService, { useClass: SSHSessionService }],
      [ISFTPSessionService, { useClass: SFTPSessionService }],
      [ITerminalSessionNotifyService, { useClass: TerminalSessionNotifyService }],
      [ISSHToolService, { useClass: SSHToolService }],
      [ICommandBlockService, { useClass: CommandBlockService }],
      [ITerminalSessionEnvService, { useClass: TerminalSessionEnvService }],
      [IPTYSessionService, { useClass: PTYSessionService }],
      [ITerminalSuggestService, { useClass: TerminalSuggestService }],
      [IShareSessionService, { useClass: ShareSessionService }],
      [IDeepLinkBus, { useClass: DeepLinkBus }],
      [ISharedTerminalService, { useClass: SharedTerminalService }],
      [McpToolsController],
      [TerminalSessionPromptController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [McpToolsController],
      [TerminalSessionPromptController],
      // Touched eagerly so its constructor wires up the OSC 633;Q and
      // blockFinished$ subscriptions before any session is created.
      [ITerminalSuggestService],
      // Eagerly construct ShareSessionService so it subscribes to the terminal session
      // notify streams before any SSH/PTY session is created. Without this, the renderer
      // could open a session before this constructor runs and miss the join event.
      [IShareSessionService],
    ]);

    this._loadPersistedLocale();
    this._watchLocaleChanges();
  }

  private async _loadPersistedLocale(): Promise<void> {
    try {
      const configRepo = this._injector.get(ConfigRepository);
      const savedLocale = await configRepo.getField<string>('ui.config', 'locale');
      if (savedLocale) {
        const localeService = this._injector.get(LocaleService);
        localeService.setLocale(savedLocale as LocaleType);
      }
    } catch {
      // ignore - use default locale
    }
  }

  private _watchLocaleChanges(): void {
    try {
      const configRepo = this._injector.get(ConfigRepository);
      const localeService = this._injector.get(LocaleService);
      this.disposeWithMe(
        configRepo.changed$.subscribe((event) => {
          if (event.key === 'ui.config' && event.subKey === 'locale') {
            configRepo.getField<string>('ui.config', 'locale').then((locale) => {
              if (locale) {
                localeService.setLocale(locale as LocaleType);
              }
            }).catch(() => {});
          }
        })
      );
    } catch {
      // ignore
    }
  }
}
