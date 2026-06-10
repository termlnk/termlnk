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

export { TERMINAL_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { ITerminalMobileConfig } from './controllers/config.schema';
export { TERMINAL_MOBILE_PLUGIN_NAME, TerminalMobilePlugin } from './plugin';
export { autoConnectArgsFromVault, resolveHostConnectArgs } from './services/auto-connect-from-vault';
export type { IHostConnectArgs } from './services/auto-connect-from-vault';
export { IMobileConnectionService, MobileConnectionService } from './services/mobile-connection.service';
export type { HostConnectionStatus, IHostConnectionState, IMobileManualCredentials } from './services/mobile-connection.service';
export { IMobileSshClientService, MobileSshClientService } from './services/mobile-ssh-client.service';
export type { IMobileSshConnectOptions, IMobileSshSession, IShellStartOptions, SshConnectionState } from './services/mobile-ssh-client.service';
export { MobileSshSessionManager } from './services/mobile-ssh-session-manager';
export type { IManagedSshSession, ManagedSessionState } from './services/mobile-ssh-session-manager';
export { evaluateServerKey, forgetServerKey, loadStoredServerKey, recordServerKey } from './services/server-key-tofu';
export type { IStoredServerKey, TofuDecision } from './services/server-key-tofu';
export { TerminalKeyBar } from './services/terminal-keybar';
export { buildXtermHtml, xtermBridge } from './services/xterm-webview-html';
