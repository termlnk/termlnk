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

import type { Observable } from 'rxjs';
import type { IXtermProgressState } from '../../models/terminal-progress.model';
import type { TerminalSessionStatus } from './terminal-ui.service';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { DEFAULT_PROGRESS_STATE, isSameProgress, XTERM_PROGRESS_STATE } from '../../models/terminal-progress.model';
import { ITerminalUIService } from './terminal-ui.service';

/**
 * Per-session terminal progress reported via OSC 9;4.
 *
 * The terminal view owns the xterm instance that parses the sequence, but the
 * pane header and tab bar live outside it (the view is portalled into the pane
 * content area), so the state has to be lifted out of the component tree.
 */
export interface ITerminalProgressService {
  /** Progress for one session. Emits immediately with the current value. */
  progress$(sessionId: string): Observable<IXtermProgressState>;
  getProgress(sessionId: string): IXtermProgressState;
  report(sessionId: string, progress: IXtermProgressState): void;
  clear(sessionId: string): void;
}

export const ITerminalProgressService = createIdentifier<ITerminalProgressService>(
  'terminal-ui.terminal-progress.service'
);

/**
 * A session in one of these states will never send its closing OSC 9;4;0, so
 * any progress it was reporting has to be cleared on its behalf.
 */
const TERMINATED_STATUSES: ReadonlySet<TerminalSessionStatus> = new Set<TerminalSessionStatus>([
  'closed',
  'error',
  'auth_failed',
]);

export class TerminalProgressService extends Disposable implements ITerminalProgressService {
  /**
   * One subject per session rather than a single map-valued subject: a pane only
   * cares about its own session, and a shared subject would re-render every pane
   * on every keystroke-driven progress update from any of them.
   */
  private readonly _progress = new Map<string, BehaviorSubject<IXtermProgressState>>();

  constructor(
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService
  ) {
    super();

    this.disposeWithMe(
      this._terminalUIService.sessions$.subscribe((sessions) => {
        const alive = new Set(sessions.map((session) => session.id));

        for (const [sessionId, subject] of this._progress) {
          if (!alive.has(sessionId)) {
            subject.complete();
            this._progress.delete(sessionId);
          }
        }

        for (const session of sessions) {
          if (TERMINATED_STATUSES.has(session.status)) {
            this.clear(session.id);
          }
        }
      })
    );
  }

  override dispose(): void {
    for (const subject of this._progress.values()) {
      subject.complete();
    }
    this._progress.clear();
    super.dispose();
  }

  progress$(sessionId: string): Observable<IXtermProgressState> {
    return this._ensureSubject(sessionId).asObservable();
  }

  getProgress(sessionId: string): IXtermProgressState {
    return this._progress.get(sessionId)?.getValue() ?? DEFAULT_PROGRESS_STATE;
  }

  report(sessionId: string, progress: IXtermProgressState): void {
    const subject = this._ensureSubject(sessionId);
    if (isSameProgress(subject.getValue(), progress)) {
      return;
    }
    subject.next(progress);
  }

  clear(sessionId: string): void {
    const subject = this._progress.get(sessionId);
    if (!subject || subject.getValue().state === XTERM_PROGRESS_STATE.NONE) {
      return;
    }
    subject.next(DEFAULT_PROGRESS_STATE);
  }

  private _ensureSubject(sessionId: string): BehaviorSubject<IXtermProgressState> {
    let subject = this._progress.get(sessionId);
    if (!subject) {
      subject = new BehaviorSubject<IXtermProgressState>(DEFAULT_PROGRESS_STATE);
      this._progress.set(sessionId, subject);
    }
    return subject;
  }
}
