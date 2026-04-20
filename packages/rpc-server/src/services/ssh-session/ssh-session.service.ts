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
import type { ISSHSessionService } from '@termlnk/rpc';
import type { IHost, IShellIntegrationConfig } from '@termlnk/terminal';
import { Disposable, ILogService, Inject, InjectSelf } from '@termlnk/core';
import { ConfigRepository, HostRepository } from '@termlnk/database';
import { IFileTransferService, ITerminalSessionNotifyService, SSHSessionStatus, SSHSocketStatus } from '@termlnk/rpc';
import { normalizeShellIntegrationConfig, SHELL_INTEGRATION_CONFIG_KEY } from '@termlnk/terminal';
import { filter, take } from 'rxjs';
import { v4 } from 'uuid';
import { resolveHostWithProxy } from '../proxy/resolve-effective-proxy';
import { ICommandBlockService } from '../shell-integration/command-block.service';
import { buildSshBootstrapCommand } from '../shell-integration/scripts';
import { ISSHSocketService } from '../ssh/ssh-socket.service';
import { SSHSession } from './ssh-session';

export class SSHSessionService extends Disposable implements ISSHSessionService {
  private _sessions = new Map<string, SSHSession>();

  constructor(
    @InjectSelf() private readonly _injector: Injector,
    @Inject(HostRepository) private readonly _hostRepository: HostRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @ITerminalSessionNotifyService private readonly _notifyService: ITerminalSessionNotifyService,
    @ICommandBlockService private readonly _commandBlockService: ICommandBlockService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    for (const session of this._sessions.values()) {
      session.close().catch(this._logService.error);
    }
    this._sessions.clear();
    super.dispose();
  }

  async createSession(hostId: string, options: { sessionId?: string; rows?: number; cols?: number; password?: string }): Promise<string> {
    const { sessionId: providedSessionId, rows = 24, cols = 80, password } = options;
    const sessionId = providedSessionId ?? v4();

    const host = await this._hostRepository.getInfoById(hostId);
    if (!host) {
      throw new Error(`Host ${hostId} not found`);
    }
    if (host.type !== 'host') {
      throw new Error(`Host ${hostId} is not a valid host type`);
    }

    const resolvedHost = await resolveHostWithProxy(host as IHost, this._configRepository);

    // SSH multiplexing key
    const multiplexerKey = this._sshSocketService.getMultiplexerKey(resolvedHost);

    // Create an ssh socket (increments refCount)
    const socket = this._sshSocketService.createSocket(multiplexerKey);

    // Decide shell-integration bootstrap command before the channel is opened.
    // If shell integration is disabled or SSH auto-inject is off, we fall back
    // to a plain interactive shell channel (bootstrapCommand = null).
    const shellIntegrationConfig = await this._readShellIntegrationConfig();
    const bootstrapCommand = this._resolveBootstrapCommand(shellIntegrationConfig);

    let session: SSHSession;
    const initialPassword = password ?? (host.credential?.type === 'password' ? host.credential.password : undefined);
    try {
      session = this._injector.createInstance(
        SSHSession,
        sessionId,
        socket,
        resolvedHost,
        cols,
        rows,
        initialPassword,
        bootstrapCommand
      );
    } catch (error) {
      this._sshSocketService.releaseSocket(multiplexerKey);
      this._logService.error('[SSHSessionService] Failed to create session', error);
      throw error instanceof Error ? error : new Error(String(error));
    }

    this._sessions.set(sessionId, session);

    const hostLabel = resolvedHost.label ?? hostId;

    this._notifyService.notifySessionCreated({
      sessionId,
      type: 'ssh',
      hostId,
      hostLabel,
    });

    session.log(`Connecting to ${hostLabel} (${host.addr}:${host.port || 22}) as ${host.credential?.username ?? 'unknown'}...`);

    this.disposeWithMe(
      session.status$
        .pipe(
          filter((status) => status === SSHSessionStatus.CLOSED),
          take(1)
        )
        .subscribe(() => {
          this._notifyService.notifySessionClosed({ sessionId, reason: session.closeReason });
          const fileTransferService = this._injector.get(IFileTransferService);
          fileTransferService?.disposeSession(sessionId);
          this._commandBlockService.detachSession(sessionId);
          this._sessions.delete(sessionId);
          session.dispose();
        })
    );

    // Attach command block tracker once the remote shell is ready. The
    // bootstrap command itself already provisioned OSC 633 hooks on the remote
    // (or opted out), so this step only wires the local data$ to the tracker.
    this.disposeWithMe(
      session.status$
        .pipe(
          filter((status) => status === SSHSessionStatus.READY),
          take(1)
        )
        .subscribe(() => {
          this._attachCommandTracker(sessionId, session, shellIntegrationConfig);
        })
    );

    // Notify on status changes (e.g. CONNECTING → READY) so context can refresh
    this.disposeWithMe(
      session.status$.subscribe((status) => {
        this._notifyService.notifySessionStatusChanged({ sessionId, status });
      })
    );

    if (socket.status === SSHSocketStatus.IDLE) {
      const connectConfig = await this._sshSocketService.createConnectConfig(resolvedHost, { password });
      session.log(`Socket connect requested (timeout=${connectConfig.readyTimeout}ms).`);
      socket.connect(connectConfig);
    }

    const fileTransferService = this._injector.get(IFileTransferService);
    fileTransferService?.initSession(sessionId);

    return sessionId;
  }

  async retrySession(sessionId: string, password: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get host info
    const host = await this._hostRepository.getInfoById(session.hostId);
    if (!host) {
      throw new Error('Host not found');
    }

    const resolvedHost = await resolveHostWithProxy(host as IHost, this._configRepository);

    this._sshSocketService.releaseSocket(session.socketId);

    session.setPassword(password);

    const multiplexerKey = this._sshSocketService.getMultiplexerKey(resolvedHost);
    const newSocket = this._sshSocketService.createSocket(multiplexerKey);
    session.rebindSocket(newSocket);

    const connectConfig = await this._sshSocketService.createConnectConfig(resolvedHost, { password });
    newSocket.connect(connectConfig);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }

    const fileTransferService = this._injector.get(IFileTransferService);
    fileTransferService?.disposeSession(sessionId);

    await session.close();
  }

  getSession(sessionId: string): SSHSession | undefined {
    return this._sessions.get(sessionId);
  }

  getAllSessions(): SSHSession[] {
    return [...this._sessions.values()];
  }

  async write(sessionId: string, data: string | Uint8Array): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.write(data);
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session.resize(rows, cols);
  }

  private _attachCommandTracker(
    sessionId: string,
    session: SSHSession,
    config: IShellIntegrationConfig
  ): void {
    if (config.mode === 'disabled') {
      this._logService.log('[SSHSessionService]', `shell integration disabled by config for ${sessionId}`);
      return;
    }

    this._commandBlockService.attachSession(sessionId, session.data$, {
      maxOutputBytes: config.maxCommandOutputBytes,
      keepRawOutput: config.keepRawAnsi,
    });

    if (!config.ssh.autoInject) {
      this._logService.log(
        '[SSHSessionService]',
        `shell integration attach only (autoInject disabled) for ${sessionId}`
      );
    }
  }

  /**
   * Build the bootstrap command that runs on the remote BEFORE the user's
   * interactive shell starts. Returns null when shell integration is disabled
   * by config — in which case the session opens a plain interactive shell
   * channel and no OSC 633 hooks are provisioned.
   */
  private _resolveBootstrapCommand(config: IShellIntegrationConfig): string | null {
    if (config.mode === 'disabled') {
      return null;
    }
    if (!config.ssh.autoInject) {
      return null;
    }
    return buildSshBootstrapCommand();
  }

  private async _readShellIntegrationConfig(): Promise<IShellIntegrationConfig> {
    try {
      const raw = await this._configRepository.get<Partial<IShellIntegrationConfig>>(
        SHELL_INTEGRATION_CONFIG_KEY
      );
      return normalizeShellIntegrationConfig(raw);
    } catch {
      return normalizeShellIntegrationConfig(null);
    }
  }
}
