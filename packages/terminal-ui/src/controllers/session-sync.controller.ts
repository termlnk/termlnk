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

import { Disposable } from '@termlnk/core';
import { ISSHService } from '@termlnk/rpc-client';
import { distinctUntilChanged } from 'rxjs';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';

/** Syncs backend session lifecycle (created/closed/focus) with UI tab state. */
export class SessionSyncController extends Disposable {
  constructor(
    @ISSHService private readonly _sshService: ISSHService,
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService
  ) {
    super();
    this._setupSync();
  }

  private _setupSync(): void {
    this.disposeWithMe(
      this._sshService.sessionCreated$.subscribe((event) => {
        const alreadyTracked = this._terminalUIService.getSession(event.sessionId);

        this._terminalUIService.addSession({
          id: event.sessionId,
          type: event.type,
          hostId: event.hostId ?? '',
          hostName: event.hostLabel ?? (event.type === 'local' ? 'Local' : 'SSH'),
        });

        // Activate only if this controller created the tab (not already tracked by commands/split/restore).
        if (!alreadyTracked) {
          this._terminalUIService.setActiveSession(event.sessionId);
        }
      })
    );

    // Keep error/auth_failed tabs open so users can see the message and retry.
    this.disposeWithMe(
      this._sshService.sessionClosed$.subscribe((event) => {
        if (event.reason) {
          return;
        }

        const existing = this._terminalUIService.getSession(event.sessionId);
        if (existing) {
          this._terminalUIService.removeSession(event.sessionId);
        }
      })
    );

    // Forward focus changes to backend (session.id IS the backend session ID)
    this.disposeWithMe(
      this._terminalUIService.activeSessionId$.pipe(
        distinctUntilChanged()
      ).subscribe((sessionId) => {
        this._sshService.setFocusedSession(sessionId ?? null).catch(() => {});
      })
    );
  }
}
