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

export { OutputBufferManager } from './common/output-buffer';
export { DEFAULT_SSH_CONNECTION_TIMEOUT } from './config/config';
export { RPC_SERVER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IRPCServerConfig } from './controllers/config.schema';
export { RPC_SERVER_PLUGIN_NAME, RPCServerPlugin } from './plugin';
export { IFileDialogService, NoopFileDialogService } from './services/file-transfer/file-dialog.service';
export { FileTransferService } from './services/file-transfer/file-transfer.service';
export { connectHttpProxy, connectSocks5Proxy, createProxySocket } from './services/proxy/proxy-socket';
export type { IProxyConnectOptions, IProxyErrorEvent, IProxySocket } from './services/proxy/proxy-socket';
export { IProxySocketService, ProxySocketService } from './services/proxy/proxy-socket.service';
export { PTYSessionService } from './services/pty/pty-session.service';
export { SFTPSession } from './services/sftp/sftp-session';
export type { ISFTPFileAttrs, ISFTPFileEntry } from './services/sftp/sftp-session';
export { ISFTPSessionService, SFTPSessionService } from './services/sftp/sftp-session.service';
export { SSHSession } from './services/ssh-session/ssh-session';
export { SSHSessionService } from './services/ssh-session/ssh-session.service';
export { SSHToolService } from './services/ssh-tool.service';
export { createSSHChannel } from './services/ssh/ssh-channel';
export type { ISSHChannel, ISSHChannelExitEvent } from './services/ssh/ssh-channel';
export { ISSHSocketService, SSHSocketService } from './services/ssh/ssh-socket.service';
export { appRouter } from './trpc/router';
export type { AppRouter } from './trpc/router';
export { aiRouter } from './trpc/routers/ai';
export type { AIRouter } from './trpc/routers/ai';
export { configRouter } from './trpc/routers/config';
export type { ConfigRouter } from './trpc/routers/config';
export { extensionRouter } from './trpc/routers/extension';
export type { ExtensionRouter } from './trpc/routers/extension';
export { fileTransferRouter } from './trpc/routers/file-transfer';
export type { FileTransferRouter } from './trpc/routers/file-transfer';
export { hostRouter } from './trpc/routers/host';
export type { HostRouter } from './trpc/routers/host';
export { localFsRouter } from './trpc/routers/local-fs';
export type { LocalFsRouter } from './trpc/routers/local-fs';
export { proxyRouter } from './trpc/routers/proxy';
export type { ProxyRouter } from './trpc/routers/proxy';
export { ptyRouter } from './trpc/routers/pty';
export type { PTYRouter } from './trpc/routers/pty';
export { sftpRouter } from './trpc/routers/sftp';
export type { SFTPRouter } from './trpc/routers/sftp';
export { sshRouter } from './trpc/routers/ssh';
export type { SSHRouter } from './trpc/routers/ssh';
export { createCallerFactory, mergeRouters, publicProcedure, router } from './trpc/trpc';
export type { IConfigChangeEvent, IConfigEntry } from '@termlnk/database';
export { ISSHToolService } from '@termlnk/rpc';
export type { IToolHostInfo, IToolSessionInfo } from '@termlnk/rpc';
export { ITerminalSessionNotifyService } from '@termlnk/rpc';
export type { AnyRouter, inferRouterInputs, inferRouterOutputs } from '@trpc/server';
