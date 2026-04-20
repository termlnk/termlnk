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

import type { ITerminalSessionClosedEvent, ITerminalSessionCreatedEvent, ITerminalSessionNotifyService, ITerminalSessionStatusChangedEvent } from '@termlnk/rpc';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export class TerminalSessionNotifyService extends Disposable implements ITerminalSessionNotifyService {
  private readonly _sessionCreated$ = new Subject<ITerminalSessionCreatedEvent>();
  readonly sessionCreated$ = this._sessionCreated$.asObservable();

  private readonly _sessionClosed$ = new Subject<ITerminalSessionClosedEvent>();
  readonly sessionClosed$ = this._sessionClosed$.asObservable();

  private readonly _sessionStatusChanged$ = new Subject<ITerminalSessionStatusChangedEvent>();
  readonly sessionStatusChanged$ = this._sessionStatusChanged$.asObservable();

  private readonly _focusedSessionId$ = new BehaviorSubject<string | null>(null);
  readonly focusedSessionId$ = this._focusedSessionId$.asObservable();

  notifySessionCreated(event: ITerminalSessionCreatedEvent): void {
    this._sessionCreated$.next(event);
  }

  notifySessionClosed(event: ITerminalSessionClosedEvent): void {
    this._sessionClosed$.next(event);

    // Clear focused session if the closed session was focused
    if (this._focusedSessionId$.getValue() === event.sessionId) {
      this._focusedSessionId$.next(null);
    }
  }

  notifySessionStatusChanged(event: ITerminalSessionStatusChangedEvent): void {
    this._sessionStatusChanged$.next(event);
  }

  setFocusedSession(sessionId: string | null): void {
    if (this._focusedSessionId$.getValue() !== sessionId) {
      this._focusedSessionId$.next(sessionId);
    }
  }

  getFocusedSessionId(): string | null {
    return this._focusedSessionId$.getValue();
  }

  override dispose(): void {
    super.dispose();
    this._sessionCreated$.complete();
    this._sessionClosed$.complete();
    this._sessionStatusChanged$.complete();
    this._focusedSessionId$.complete();
  }
}
