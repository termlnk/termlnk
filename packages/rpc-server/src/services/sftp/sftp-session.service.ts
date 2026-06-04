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

import type { Injector } from '@termlnk/core';
import type { ISFTPTransferTask } from '@termlnk/rpc';
import type { IHost } from '@termlnk/terminal';
import type { Buffer } from 'node:buffer';
import type { Observable } from 'rxjs';
import type { IHostChainHandle } from '../ssh/ssh-host-chain.service';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { ISFTPFileAttrs, ISFTPFileEntry } from './sftp-session';
import { createIdentifier, Disposable, ILogService, Inject, InjectSelf } from '@termlnk/core';
import { ConfigRepository, HostRepository } from '@termlnk/database';
import { SFTPSessionStatus, SSHSocketStatus, TransferDirection, TransferStatus } from '@termlnk/rpc';
import { getCredentialUsername } from '@termlnk/terminal';
import { filter, Subject, take } from 'rxjs';
import { v4 } from 'uuid';
import { resolveHostWithProxy } from '../proxy/resolve-effective-proxy';
import { ISSHHostChainService } from '../ssh/ssh-host-chain.service';
import { ISSHSocketService } from '../ssh/ssh-socket.service';
import { SFTPSession } from './sftp-session';

export interface ISFTPSessionService {
  createSession(hostId: string, options?: { password?: string }): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  retrySession(sessionId: string, password: string): Promise<void>;
  getSession(sessionId: string): SFTPSession | undefined;

  // File operations
  list(sessionId: string, path: string): Promise<ISFTPFileEntry[]>;
  stat(sessionId: string, path: string): Promise<ISFTPFileAttrs>;
  mkdir(sessionId: string, path: string): Promise<void>;
  rmdir(sessionId: string, path: string): Promise<void>;
  unlink(sessionId: string, path: string): Promise<void>;
  rename(sessionId: string, oldPath: string, newPath: string): Promise<void>;
  chmod(sessionId: string, path: string, mode: number): Promise<void>;
  readFile(sessionId: string, path: string): Promise<Buffer>;
  writeFile(sessionId: string, path: string, data: Buffer): Promise<void>;
  realpath(sessionId: string, path: string): Promise<string>;

  // Transfer
  download(sessionId: string, remotePath: string, localPath: string): Promise<string>;
  upload(sessionId: string, localPath: string, remotePath: string): Promise<string>;
  uploadDirectory(sessionId: string, localBasePath: string, remoteBasePath: string, entries: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>): Promise<string[]>;
  cancelTransfer(transferId: string): Promise<void>;

  // Observables
  readonly transferProgress$: Observable<ISFTPTransferTask>;
}
export const ISFTPSessionService = createIdentifier<ISFTPSessionService>('rpc-server.sftp-session-service');

export class SFTPSessionService extends Disposable implements ISFTPSessionService {
  private _sessions = new Map<string, SFTPSession>();
  private readonly _transfers = new Map<string, ISFTPTransferTask>();
  private readonly _cancelledTransfers = new Set<string>();
  private readonly _transferProgress$ = new Subject<ISFTPTransferTask>();
  readonly transferProgress$: Observable<ISFTPTransferTask> = this._transferProgress$.asObservable();

  constructor(
    @InjectSelf() private readonly _injector: Injector,
    @Inject(HostRepository) private readonly _hostRepository: HostRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @ISSHHostChainService private readonly _sshHostChainService: ISSHHostChainService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    for (const session of this._sessions.values()) {
      session.close().catch(this._logService.error);
    }
    this._sessions.clear();
    this._transfers.clear();
    this._transferProgress$.complete();
    this._cancelledTransfers.clear();
    super.dispose();
  }

  async createSession(hostId: string, options?: { password?: string }): Promise<string> {
    const sessionId = v4();
    const { password } = options || {};

    const host = await this._hostRepository.getInfoById(hostId);
    if (!host) {
      throw new Error(`Host ${hostId} not found`);
    }
    if (host.type !== 'host') {
      throw new Error(`Host ${hostId} is not a valid host type`);
    }

    const resolvedHost = await resolveHostWithProxy(host as IHost, this._configRepository);

    // Same semantics as SSHSessionService: chain build runs asynchronously
    // so that sessionId returns immediately.
    const chainHandle = await this._sshHostChainService.startTunnel(resolvedHost);

    const multiplexerKey = this._sshSocketService.getMultiplexerKey(resolvedHost);
    const socket = this._sshSocketService.createSocket(multiplexerKey);

    const initialPassword = password ?? (host.credential?.type === 'password' ? host.credential.password : undefined);

    let session: SFTPSession;
    try {
      session = this._injector.createInstance(SFTPSession, sessionId, socket, hostId, initialPassword);
      if (chainHandle) {
        session.attachHostChain(chainHandle);
      }
    } catch (error) {
      this._sshSocketService.releaseSocket(multiplexerKey);
      chainHandle?.dispose();
      this._logService.error('[SFTPSessionService] Failed to create session', error);
      throw error instanceof Error ? error : new Error(String(error));
    }

    this._sessions.set(sessionId, session);

    const hostLabel = resolvedHost.label ?? hostId;
    this._logService.debug(`SFTP connecting to ${hostLabel} (${host.addr}:${host.port || 22}) as ${getCredentialUsername(host.credential) || 'unknown'}...`);

    this.disposeWithMe(
      session.status$
        .pipe(
          filter((status) => status === SFTPSessionStatus.CLOSED),
          take(1)
        )
        .subscribe(() => {
          this._sessions.delete(sessionId);
          session.dispose();
        })
    );

    if (chainHandle) {
      this._connectViaChain(session, socket, resolvedHost, password, multiplexerKey, chainHandle);
    } else if (socket.status === SSHSocketStatus.IDLE) {
      const connectConfig = await this._sshSocketService.createConnectConfig(resolvedHost, {
        password,
      });
      this._logService.debug(`Socket connect requested (timeout=${connectConfig.readyTimeout}ms).`);
      socket.connect(connectConfig);
    }

    return sessionId;
  }

  async retrySession(sessionId: string, password: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const host = await this._hostRepository.getInfoById(session.hostId);
    if (!host) {
      throw new Error('Host not found');
    }

    const resolvedHost = await resolveHostWithProxy(host as IHost, this._configRepository);

    this._sshSocketService.releaseSocket(session.socketId);
    if (password.length > 0) {
      session.setPassword(password);
    }

    const chainHandle = await this._sshHostChainService.startTunnel(resolvedHost);

    const multiplexerKey = this._sshSocketService.getMultiplexerKey(resolvedHost);
    const newSocket = this._sshSocketService.createSocket(multiplexerKey);
    session.rebindSocket(newSocket);
    if (chainHandle) {
      session.attachHostChain(chainHandle);
      this._connectViaChain(session, newSocket, resolvedHost, password, multiplexerKey, chainHandle);
    } else {
      const connectConfig = await this._sshSocketService.createConnectConfig(resolvedHost, {
        password,
      });
      newSocket.connect(connectConfig);
    }
  }

  /**
   * Wire `chainHandle.ready` to `socket.connect`. Fire-and-forget; failures
   * surface via `session.markChainFailed` and the socket refcount is released.
   */
  private _connectViaChain(
    session: SFTPSession,
    socket: ISSHSocket,
    host: IHost,
    password: string | undefined,
    multiplexerKey: string,
    chainHandle: IHostChainHandle
  ): void {
    chainHandle.ready
      .then(async (finalSock) => {
        if (socket.status !== SSHSocketStatus.IDLE) {
          return;
        }
        const connectConfig = await this._sshSocketService.createConnectConfig(host, {
          password,
          chainTunnel: finalSock,
        });
        this._logService.debug(`Socket connect requested (timeout=${connectConfig.readyTimeout}ms).`);
        socket.connect(connectConfig);
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        session.markChainFailed(error);
        this._sshSocketService.releaseSocket(multiplexerKey);
      });
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    await session.close();
  }

  getSession(sessionId: string): SFTPSession | undefined {
    return this._sessions.get(sessionId);
  }

  // --- File operations ---

  async list(sessionId: string, path: string): Promise<ISFTPFileEntry[]> {
    return this._getSession(sessionId).list(path);
  }

  async stat(sessionId: string, path: string): Promise<ISFTPFileAttrs> {
    return this._getSession(sessionId).stat(path);
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    return this._getSession(sessionId).mkdir(path);
  }

  async rmdir(sessionId: string, path: string): Promise<void> {
    return this._getSession(sessionId).rmdir(path);
  }

  async unlink(sessionId: string, path: string): Promise<void> {
    return this._getSession(sessionId).unlink(path);
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    return this._getSession(sessionId).rename(oldPath, newPath);
  }

  async chmod(sessionId: string, path: string, mode: number): Promise<void> {
    return this._getSession(sessionId).chmod(path, mode);
  }

  async readFile(sessionId: string, path: string): Promise<Buffer> {
    return this._getSession(sessionId).readFile(path);
  }

  async writeFile(sessionId: string, path: string, data: Buffer): Promise<void> {
    return this._getSession(sessionId).writeFile(path, data);
  }

  async realpath(sessionId: string, path: string): Promise<string> {
    return this._getSession(sessionId).realpath(path);
  }

  // --- Transfer ---

  async download(sessionId: string, remotePath: string, localPath: string): Promise<string> {
    const session = this._getSession(sessionId);
    const transferId = v4();
    const filename = remotePath.split('/').pop() || remotePath;

    let totalBytes = 0;
    try {
      const stats = await session.stat(remotePath);
      totalBytes = stats.size;
    } catch {
      // If stat fails, proceed with unknown size
    }

    const task: ISFTPTransferTask = {
      id: transferId,
      sessionId,
      direction: TransferDirection.DOWNLOAD,
      localPath,
      remotePath,
      filename,
      totalBytes,
      transferredBytes: 0,
      status: TransferStatus.PENDING,
    };
    this._transfers.set(transferId, task);
    this._transferProgress$.next({ ...task });

    this._executeTransfer(transferId, session, 'download', remotePath, localPath);

    return transferId;
  }

  async upload(sessionId: string, localPath: string, remotePath: string): Promise<string> {
    const session = this._getSession(sessionId);
    const transferId = v4();
    const filename = localPath.split('/').pop() || localPath;

    const task: ISFTPTransferTask = {
      id: transferId,
      sessionId,
      direction: TransferDirection.UPLOAD,
      localPath,
      remotePath,
      filename,
      totalBytes: 0,
      transferredBytes: 0,
      status: TransferStatus.PENDING,
    };
    this._transfers.set(transferId, task);
    this._transferProgress$.next({ ...task });

    this._executeTransfer(transferId, session, 'upload', localPath, remotePath);

    return transferId;
  }

  async uploadDirectory(
    sessionId: string,
    localBasePath: string,
    remoteBasePath: string,
    entries: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>
  ): Promise<string[]> {
    const session = this._getSession(sessionId);
    const transferIds: string[] = [];

    // Create all directories first, in order (parents before children)
    const dirs = entries.filter((e) => e.isDirectory);
    for (const dir of dirs) {
      const remotePath = `${remoteBasePath}/${dir.relativePath}`;
      try {
        await session.mkdir(remotePath);
      } catch (err: any) {
        // Ignore "already exists" errors (SFTP error code 4 = Failure, commonly for existing dir)
        if (err?.code !== 4) {
          this._logService.error(`[SFTPSessionService] mkdir failed: ${remotePath}`, err);
        }
      }
    }

    // Upload all files
    const files = entries.filter((e) => !e.isDirectory);
    for (const file of files) {
      const remotePath = `${remoteBasePath}/${file.relativePath}`;
      const transferId = await this.upload(sessionId, file.absolutePath, remotePath);
      transferIds.push(transferId);
    }

    return transferIds;
  }

  async cancelTransfer(transferId: string): Promise<void> {
    const task = this._transfers.get(transferId);
    if (!task) return;
    this._cancelledTransfers.add(transferId);
    task.status = TransferStatus.CANCELLED;
    this._transferProgress$.next({ ...task });
  }

  private async _executeTransfer(
    transferId: string,
    session: SFTPSession,
    direction: 'download' | 'upload',
    sourcePath: string,
    destPath: string
  ): Promise<void> {
    const task = this._transfers.get(transferId);
    if (!task) return;

    task.status = TransferStatus.TRANSFERRING;
    this._transferProgress$.next({ ...task });

    try {
      const onProgress = (transferred: number, total: number) => {
        if (this._cancelledTransfers.has(transferId)) return;
        task.transferredBytes = transferred;
        task.totalBytes = total;
        this._transferProgress$.next({ ...task });
      };

      if (direction === 'download') {
        await session.download(sourcePath, destPath, onProgress);
      } else {
        await session.upload(sourcePath, destPath, onProgress);
      }

      if (this._cancelledTransfers.has(transferId)) {
        this._cancelledTransfers.delete(transferId);
        return;
      }

      task.status = TransferStatus.COMPLETED;
      task.transferredBytes = task.totalBytes;
      this._transferProgress$.next({ ...task });
    } catch (err) {
      if (this._cancelledTransfers.has(transferId)) {
        this._cancelledTransfers.delete(transferId);
        return;
      }
      task.status = TransferStatus.FAILED;
      task.error = err instanceof Error ? err.message : String(err);
      this._transferProgress$.next({ ...task });
    }
  }

  private _getSession(sessionId: string): SFTPSession {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`SFTP session ${sessionId} not found`);
    }
    return session;
  }
}
