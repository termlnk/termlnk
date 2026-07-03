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
import type { ILocalTerminalConfig, ILocalTerminalShellOption, IPTYCreateSessionOptions, IPTYSessionService } from '@termlnk/terminal';
import { Disposable, ILogService, Inject, InjectSelf, Platform, platform } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { ITerminalSessionNotifyService } from '@termlnk/rpc';
import { PTYSessionStatus, TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/terminal';
import { filter, take } from 'rxjs';
import { v4 } from 'uuid';
import { ICommandBlockService } from '../shell-integration/command-block.service';
import { getAvailableLocalTerminalShellOptions, resolveConfiguredLocalTerminalShell } from './local-terminal-shell';
import { PTYSession } from './pty-session';

export class PTYSessionService extends Disposable implements IPTYSessionService {
  private readonly _sessions = new Map<string, PTYSession>();
  private _closeQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectSelf() private readonly _injector: Injector,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
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

  async createSession(options: IPTYCreateSessionOptions = {}): Promise<string> {
    const sessionId = options.sessionId ?? v4();
    // A client-provided id must not silently replace a live session: the old
    // session's CLOSED subscription would later delete the new one by id.
    if (this._sessions.has(sessionId)) {
      throw new Error(`PTY session ${sessionId} already exists`);
    }
    const shell = options.shell ?? await this._resolveDefaultShell();
    const sessionOptions = shell ? { ...options, shell } : options;

    const sessionInstance = this._injector.createInstance(PTYSession, sessionId, sessionOptions);
    this._sessions.set(sessionId, sessionInstance);

    this._commandBlockService.attachSession(sessionId, sessionInstance.data$);

    this._notifyService.notifySessionCreated({
      sessionId,
      type: 'local',
      hostLabel: 'Local',
    });

    // Auto-remove from map when session closes
    this.disposeWithMe(
      sessionInstance.status$
        .pipe(
          filter((status) => status === PTYSessionStatus.CLOSED),
          take(1)
        )
        .subscribe(() => {
          this._notifyService.notifySessionClosed({ sessionId });
          this._commandBlockService.detachSession(sessionId);
          this._sessions.delete(sessionId);
          sessionInstance.dispose();
        })
    );

    // Notify on status changes so context can refresh
    this.disposeWithMe(
      sessionInstance.status$.subscribe((status) => {
        this._notifyService.notifySessionStatusChanged({ sessionId, status });
      })
    );

    return sessionId;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this._getSessionOrThrow(sessionId);

    if (platform !== Platform.Windows) {
      await session.close();
      return;
    }

    const closeTask = this._closeQueue.then(async () => {
      await session.close();
    });

    this._closeQueue = closeTask.catch((error) => {
      this._logService.error('[PTYSessionService] Failed to close PTY session:', error);
    });

    await closeTask;
  }

  getSession(sessionId: string): PTYSession | undefined {
    return this._sessions.get(sessionId);
  }

  getAllSessions(): PTYSession[] {
    return [...this._sessions.values()];
  }

  async write(sessionId: string, data: string): Promise<void> {
    this._getSessionOrThrow(sessionId).write(data);
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    this._getSessionOrThrow(sessionId).resize(rows, cols);
  }

  async getShellPath(sessionId: string): Promise<string> {
    return this._getSessionOrThrow(sessionId).shellPath;
  }

  async getCurrentCwd(sessionId: string): Promise<string> {
    return this._commandBlockService.getCurrentCwd(sessionId);
  }

  async getLocalTerminalShellOptions(): Promise<ILocalTerminalShellOption[]> {
    return getAvailableLocalTerminalShellOptions(platform);
  }

  private _getSessionOrThrow(sessionId: string): PTYSession {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`PTY session ${sessionId} not found`);
    }
    return session;
  }

  private async _resolveDefaultShell(): Promise<string | undefined> {
    try {
      const config = await this._configRepository.getField<ILocalTerminalConfig>(TERMINAL_PLUGIN_CONFIG_KEY, 'localTerminal');
      return resolveConfiguredLocalTerminalShell(config, platform);
    } catch (error) {
      this._logService.error('[PTYSessionService] Failed to resolve local terminal shell:', error);
      return undefined;
    }
  }
}
