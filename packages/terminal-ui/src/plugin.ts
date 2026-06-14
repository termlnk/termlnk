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
import type { ITerminalUIConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { TerminalPlugin } from '@termlnk/terminal';
import { UIPlugin } from '@termlnk/ui';
import { defaultPluginConfig, TERMINAL_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { HostDialogController } from './controllers/host-dialog/host-dialog.controller';
import { HostsExplorerController } from './controllers/hosts-explorer/hosts-explorer.controller';
import { KeychainController } from './controllers/keychain/keychain.controller';
import { KeychainDialogController } from './controllers/keychain/keychain-dialog.controller';
import { KnownHostDetailDialogController } from './controllers/known-hosts/known-host-detail-dialog.controller';
import { KnownHostsController } from './controllers/known-hosts/known-hosts.controller';
import { SessionSyncController } from './controllers/session-sync.controller';
import { TerminalPersistenceController } from './controllers/terminal-persistence.controller';
import { TerminalUIController } from './controllers/terminal-ui.controller';
import { WorkspaceController } from './controllers/workspace/workspace.controller';
import { HostDialogService } from './services/host-dialog/host-dialog.service';
import { HostExplorerService, IHostExplorerService } from './services/hosts-explorer/hosts-explorer.service';
import { IKeychainDialogService, KeychainDialogService } from './services/keychain/keychain-dialog.service';
import { IKnownHostDetailDialogService, KnownHostDetailDialogService } from './services/known-hosts/known-host-detail-dialog.service';
import { ILastCwdService, LastCwdService } from './services/local-terminal/last-cwd.service';
import { ITabListDropdownService, TabListDropdownService } from './services/tab-list-dropdown/tab-list-dropdown.service';
import { ITerminalInputService, TerminalInputService } from './services/terminal-input/terminal-input.service';
import { ITerminalPersistenceService, TerminalPersistenceService } from './services/terminal/terminal-persistence.service';
import { ITerminalUIService, TerminalUIService } from './services/terminal/terminal-ui.service';
import { ITerminalViewRegistry, TerminalViewRegistry } from './services/terminal/terminal-view-registry.service';
import { IWorkspaceService, WorkspaceService } from './services/workspace/workspace.service';

export const TERMINAL_UI_PLUGIN_NAME = 'TERMINAL_UI_PLUGIN';

@DependentOn(UIPlugin, RPCClientPlugin, TerminalPlugin)
export class TerminalUIPlugin extends Plugin {
  static override pluginName = TERMINAL_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ITerminalUIConfig> = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(TERMINAL_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [HostDialogController],
      [HostsExplorerController],
      [TerminalUIController],
      [WorkspaceController],
      [TerminalPersistenceController],
      [SessionSyncController],
      [KeychainController],
      [KeychainDialogController],
      [KnownHostDetailDialogController],
      [KnownHostsController],
    ]);
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [HostDialogService, { useClass: HostDialogService }],
      [IHostExplorerService, { useClass: HostExplorerService }],
      [IKeychainDialogService, { useClass: KeychainDialogService }],
      [IKnownHostDetailDialogService, { useClass: KnownHostDetailDialogService }],
      [ITerminalUIService, { useClass: TerminalUIService }],
      [ITerminalViewRegistry, { useClass: TerminalViewRegistry }],
      [ITabListDropdownService, { useClass: TabListDropdownService }],
      [IWorkspaceService, { useClass: WorkspaceService }],
      [ITerminalPersistenceService, { useClass: TerminalPersistenceService }],
      [ITerminalInputService, { useClass: TerminalInputService }],
      [ILastCwdService, { useClass: LastCwdService }],

      [HostDialogController],
      [HostsExplorerController],
      [TerminalUIController],
      [WorkspaceController],
      [TerminalPersistenceController],
      [SessionSyncController],
      [KeychainController],
      [KeychainDialogController],
      [KnownHostDetailDialogController],
      [KnownHostsController],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
