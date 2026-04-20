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

import { agentMonitorRouter } from './routers/agent-monitor';
import { aiRouter } from './routers/ai';
import { chatRouter } from './routers/chat';
import { configRouter } from './routers/config';
import { extensionRouter } from './routers/extension';
import { fileTransferRouter } from './routers/file-transfer';
import { hostRouter } from './routers/host';
import { localFsRouter } from './routers/local-fs';
import { mcpRouter } from './routers/mcp';
import { mcpRegistryRouter } from './routers/mcp-registry';
import { notifyRouter } from './routers/notify';
import { permissionRouter } from './routers/permission';
import { proxyRouter } from './routers/proxy';
import { ptyRouter } from './routers/pty';
import { sftpRouter } from './routers/sftp';
import { skillRouter } from './routers/skill';
import { sshRouter } from './routers/ssh';
import { terminalSessionBackupRouter } from './routers/terminal-session-backup';
import { router } from './trpc';

export const appRouter = router({
  agentMonitor: agentMonitorRouter,
  ai: aiRouter,
  chat: chatRouter,
  config: configRouter,
  host: hostRouter,
  mcp: mcpRouter,
  mcpRegistry: mcpRegistryRouter,
  notify: notifyRouter,
  permission: permissionRouter,
  proxy: proxyRouter,
  skill: skillRouter,
  ssh: sshRouter,
  fileTransfer: fileTransferRouter,
  sftp: sftpRouter,
  pty: ptyRouter,
  localFs: localFsRouter,
  extension: extensionRouter,
  terminalSessionBackup: terminalSessionBackupRouter,
});
export type AppRouter = typeof appRouter;
