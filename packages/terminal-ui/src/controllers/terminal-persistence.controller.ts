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

import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { ISSHService } from '@termlnk/rpc-client';
import { IPTYService } from '@termlnk/terminal';
import { ITerminalPersistenceService } from '../services/terminal/terminal-persistence.service';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';
import { IWorkspaceService } from '../services/workspace/workspace.service';

const AUTO_SAVE_INTERVAL = 30000;

export class TerminalPersistenceController extends Disposable {
  private _autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @ITerminalPersistenceService private readonly _persistenceService: ITerminalPersistenceService,
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService,
    @IWorkspaceService private readonly _workspaceService: IWorkspaceService,
    @IPTYService private readonly _ptyService: IPTYService,
    @ISSHService private readonly _sshService: ISSHService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this._restoreSessions();
    this._registerBeforeUnload();
    this._startAutoSave();
  }

  private _restoreSessions(): void {
    this._persistenceService.loadState().then(async (state) => {
      if (!state || state.sessions.length === 0) {
        return;
      }

      // Step 1: Pre-register UI tabs with saved state so SessionSyncController's
      // addSession() is a no-op when backend events arrive.
      for (const saved of state.sessions) {
        this._terminalUIService.addSession({
          id: saved.id,
          type: saved.type,
          hostId: saved.hostId,
          hostName: saved.hostName,
          title: saved.title,
          status: 'idle',
        });
      }

      // Step 2: Recreate backend sessions (events are no-op since IDs already registered).
      for (const saved of state.sessions) {
        try {
          if (saved.type === 'ssh') {
            await this._sshService.createSession(saved.hostId, 80, 24, undefined, saved.id);
          } else {
            await this._ptyService.createSession({
              sessionId: saved.id,
              cols: saved.cols || 80,
              rows: saved.rows || 24,
              cwd: saved.cwd || undefined,
              restored: true,
            });
          }
        } catch (err) {
          this._terminalUIService.removeSession(saved.id);
          this._logService.warn('[TerminalPersistenceController]', `Failed to recreate session ${saved.id}:`, err);
        }
      }

      // Step 3: Restore tab order and workspace layout.
      // tabItems$ ignores IDs that don't match any workspace or session.
      const tabItemOrder = state.tabItemOrder.length > 0
        ? state.tabItemOrder
        : state.sessions.map((s) => s.id);

      if (state.workspaces && state.workspaces.length > 0) {
        this._logService.debug('[TerminalPersistenceController]', `Restoring ${state.workspaces.length} workspace(s)...`);
      }

      this._workspaceService.restoreWorkspaces(
        state.workspaces ?? [],
        tabItemOrder,
        state.activeTabItemId
      );

      this._persistenceService.clearState();
    }).catch((err) => {
      this._logService.warn('[TerminalPersistenceController]', 'Failed to restore sessions:', err);
    });
  }

  private _registerBeforeUnload(): void {
    const handler = () => {
      this._persistenceService.saveState();
    };
    window.addEventListener('beforeunload', handler);
    this.disposeWithMe(toDisposable(() => window.removeEventListener('beforeunload', handler)));
  }

  private _startAutoSave(): void {
    this._autoSaveTimer = setInterval(() => {
      this._persistenceService.saveState();
    }, AUTO_SAVE_INTERVAL);

    this.disposeWithMe(toDisposable(() => {
      if (this._autoSaveTimer) {
        clearInterval(this._autoSaveTimer);
        this._autoSaveTimer = null;
      }
    }));
  }
}
