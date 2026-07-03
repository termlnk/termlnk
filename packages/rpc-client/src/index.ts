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

export { RPC_CLIENT_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IRPCClientConfig } from './controllers/config.schema';
export { RPC_CLIENT_PLUGIN_NAME, RPCClientPlugin } from './plugin';
export { AIAgentMessagingService, IAIAgentMessagingService } from './services/ai/ai-agent-messaging.service';
export { ChatSessionClientService, IChatSessionService } from './services/ai/chat-session-client.service';
export { IProviderConfigService, ProviderConfigClientService } from './services/ai/provider-config-client.service';
export { ConfigManagerService, IConfigManagerService } from './services/config/config-manager.service';
export { ExtensionManagementService, IExtensionManagementService } from './services/extension/extension-management.service';
export { FileTransferService } from './services/file-transfer/file-transfer.service';
export { HostManagerService, IHostManagerService } from './services/host/host-manager.service';
export { IKeychainManagerService, KeychainManagerService } from './services/keychain/keychain-manager.service';
export type { ICreateIdentityInput, IGenerateKeyInput, IImportKeyInput, IKeychainReferrers, IUpdateIdentityInput, IUpdateKeyInput } from './services/keychain/keychain-manager.service';
export { McpRegistryService } from './services/mcp/mcp-registry.service';
export { McpService } from './services/mcp/mcp.service';
export { NotifyService } from './services/notify/notify.service';
export { AgentToolPermissionService, IAgentToolPermissionService } from './services/permission/permission-client.service';
export { PortForwardingClientService } from './services/port-forwarding/port-forwarding.service';
export { IProxyService, ProxyClientService } from './services/proxy/proxy.service';
export type { IProxyTestInput, IProxyTestResult } from './services/proxy/proxy.service';
export { PTYService } from './services/pty/pty.service';
export { IRPCClientService } from './services/rpc-client.service';
export { ISFTPService, SFTPClientService } from './services/sftp/sftp.service';
export { SkillService } from './services/skill/skill.service';
export { ISSHService, SSHService } from './services/ssh/ssh.service';
export type { ISSHTestConnectionInput, ISSHTestConnectionResult } from './services/ssh/ssh.service';
export { ITerminalSessionBackupService, TerminalSessionBackupService } from './services/terminal-session-backup/terminal-session-backup.service';
export type { AnyRouter, AppRouter, IConfigChangeEvent, IConfigEntry } from '@termlnk/rpc-server';
export type { TRPCClient } from '@trpc/client';
