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

import type { Nullable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type TerminalSessionStatus = 'idle' | 'connecting' | 'authenticating' | 'opening_shell' | 'ready' | 'closed' | 'auth_failed' | 'error';

export interface ITerminalSession {
  id: string;
  type: string;
  hostId: string;
  hostName: string;
  title?: string;
  status: TerminalSessionStatus;
}

export type AddSessionParams = Omit<ITerminalSession, 'status'> & { status?: TerminalSessionStatus };

export interface ITerminalUIService {
  readonly sessions$: Observable<ITerminalSession[]>;
  readonly activeSessionId$: Observable<Nullable<string>>;

  addSession(session: AddSessionParams): void;
  removeSession(sessionId: string): void;
  setActiveSession(sessionId: string | null): void;
  moveSession(sessionId: string, targetSessionId: string, position: 'before' | 'after'): void;
  updateSessionStatus(sessionId: string, status: TerminalSessionStatus): void;
  updateSessionTitle(sessionId: string, title: string): void;
  getSession(sessionId: string): ITerminalSession | undefined;
  getAllSessions(): ITerminalSession[];
  getActiveSessionId(): string | null;
}
export const ITerminalUIService = createIdentifier<ITerminalUIService>('terminal-ui.terminal-ui-service');

export class TerminalUIService extends Disposable implements ITerminalUIService {
  private readonly _sessions$ = new BehaviorSubject<ITerminalSession[]>([]);
  readonly sessions$ = this._sessions$.asObservable();

  private readonly _activeSessionId$ = new BehaviorSubject<Nullable<string>>(null);
  readonly activeSessionId$ = this._activeSessionId$.asObservable();

  override dispose(): void {
    this._sessions$.complete();
    this._activeSessionId$.complete();
    super.dispose();
  }

  addSession(session: AddSessionParams): void {
    const sessions = this._sessions$.value;
    if (sessions.some((s) => s.id === session.id)) {
      return;
    }

    const newSession: ITerminalSession = {
      ...session,
      status: session.status ?? 'connecting',
    };
    this._sessions$.next([...sessions, newSession]);

    // Auto-select if it's the first session
    if (sessions.length === 0) {
      this._activeSessionId$.next(session.id);
    }
  }

  removeSession(sessionId: string): void {
    const sessions = this._sessions$.value.filter((s) => s.id !== sessionId);
    this._sessions$.next(sessions);

    // If the active session was removed, select another one
    if (this._activeSessionId$.value === sessionId) {
      this._activeSessionId$.next(sessions.length > 0 ? sessions[0].id : null);
    }
  }

  setActiveSession(sessionId: string | null): void {
    if (this._activeSessionId$.value === sessionId) {
      return;
    }
    this._activeSessionId$.next(sessionId);
  }

  moveSession(sessionId: string, targetSessionId: string, position: 'before' | 'after'): void {
    const sessions = [...this._sessions$.value];
    const fromIndex = sessions.findIndex((s) => s.id === sessionId);
    const targetIndex = sessions.findIndex((s) => s.id === targetSessionId);

    if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
      return;
    }

    const [moved] = sessions.splice(fromIndex, 1);
    const nextTargetIndex = sessions.findIndex((s) => s.id === targetSessionId);
    if (nextTargetIndex === -1) {
      return;
    }

    const insertIndex = position === 'after' ? nextTargetIndex + 1 : nextTargetIndex;
    sessions.splice(insertIndex, 0, moved);
    this._sessions$.next(sessions);
  }

  updateSessionStatus(sessionId: string, status: TerminalSessionStatus): void {
    const sessions = this._sessions$.value;
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) {
      return;
    }

    const current = sessions[index];
    if (current.status === status) {
      return;
    }

    const next = [...sessions];
    next[index] = { ...current, status };
    this._sessions$.next(next);
  }

  updateSessionTitle(sessionId: string, title: string): void {
    const sessions = this._sessions$.value;
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) {
      return;
    }

    const current = sessions[index];
    if (current.title === title) {
      return;
    }

    const next = [...sessions];
    next[index] = { ...current, title };
    this._sessions$.next(next);
  }

  getSession(sessionId: string): ITerminalSession | undefined {
    return this._sessions$.value.find((s) => s.id === sessionId);
  }

  getAllSessions(): ITerminalSession[] {
    return [...this._sessions$.value];
  }

  getActiveSessionId(): string | null {
    return this._activeSessionId$.value ?? null;
  }
}
