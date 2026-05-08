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
import type { IRPCClientConfig } from './controllers/config.schema';
import { IMcpRegistryService, IMcpService, ISkillService } from '@termlnk/agent';
import { IAuthClientService } from '@termlnk/auth';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { INotifyService, RPCPlugin } from '@termlnk/rpc';
import { IPTYService } from '@termlnk/terminal';
import { defaultPluginConfig, RPC_CLIENT_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { AIAgentClientService, IAIAgentClientService } from './services/ai/ai-agent-client.service';
import { ChatSessionClientService, IChatSessionClientService } from './services/ai/chat-session-client.service';
import { IProviderConfigClientService, ProviderConfigClientService } from './services/ai/provider-config-client.service';
import { AuthClientService } from './services/auth/auth-client.service';
import { ConfigManagerService, IConfigManagerService } from './services/config/config-manager.service';
import { ExtensionClientService, IExtensionClientService } from './services/extension/extension-client.service';
import { FileTransferClientService, IFileTransferClientService } from './services/file-transfer/file-transfer.service';
import { HostManagerService, IHostManagerService } from './services/host/host-manager.service';
import { McpRegistryService } from './services/mcp/mcp-registry.service';
import { McpService } from './services/mcp/mcp.service';
import { NotifyService } from './services/notify/notify.service';
import { IPermissionClientService, PermissionClientService } from './services/permission/permission-client.service';
import { IProxyClientService, ProxyClientService } from './services/proxy/proxy.service';
import { PTYService } from './services/pty/pty.service';
import { ISFTPClientService, SFTPClientService } from './services/sftp/sftp.service';
import { SkillService } from './services/skill/skill.service';
import { ISSHService, SSHService } from './services/ssh/ssh.service';
import { ITerminalSessionBackupService, TerminalSessionBackupService } from './services/terminal-session-backup/terminal-session-backup.service';

export const RPC_CLIENT_PLUGIN_NAME = 'RPC_CLIENT_PLUGIN';

@DependentOn(RPCPlugin)
export class RPCClientPlugin extends Plugin {
  static override pluginName = RPC_CLIENT_PLUGIN_NAME;

  constructor(
    private readonly _config: IRPCClientConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(RPC_CLIENT_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._registerDependencies();
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [INotifyService],
    ]);
  }

  private _registerDependencies() {
    const dependencies: Dependency[] = [
      [IAIAgentClientService, { useClass: AIAgentClientService }],
      [IAuthClientService, { useClass: AuthClientService }],
      [IChatSessionClientService, { useClass: ChatSessionClientService }],
      [IProviderConfigClientService, { useClass: ProviderConfigClientService }],
      [IConfigManagerService, { useClass: ConfigManagerService }],
      [IExtensionClientService, { useClass: ExtensionClientService }],
      [IFileTransferClientService, { useClass: FileTransferClientService }],
      [IHostManagerService, { useClass: HostManagerService }],
      [IMcpService, { useClass: McpService }],
      [IMcpRegistryService, { useClass: McpRegistryService }],
      [INotifyService, { useClass: NotifyService }],
      [IPermissionClientService, { useClass: PermissionClientService }],
      [IProxyClientService, { useClass: ProxyClientService }],
      [IPTYService, { useClass: PTYService }],
      [ISFTPClientService, { useClass: SFTPClientService }],
      [ISkillService, { useClass: SkillService }],
      [ISSHService, { useClass: SSHService }],
      [ITerminalSessionBackupService, { useClass: TerminalSessionBackupService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
