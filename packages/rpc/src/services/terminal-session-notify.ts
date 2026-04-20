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
import type { ITerminalSessionClosedEvent, ITerminalSessionCreatedEvent, ITerminalSessionStatusChangedEvent } from '../models/terminal-session';
import { createIdentifier } from '@termlnk/core';

export interface ITerminalSessionNotifyService {
  readonly sessionCreated$: Observable<ITerminalSessionCreatedEvent>;
  readonly sessionClosed$: Observable<ITerminalSessionClosedEvent>;
  readonly sessionStatusChanged$: Observable<ITerminalSessionStatusChangedEvent>;
  readonly focusedSessionId$: Observable<string | null>;
  notifySessionCreated(event: ITerminalSessionCreatedEvent): void;
  notifySessionClosed(event: ITerminalSessionClosedEvent): void;
  notifySessionStatusChanged(event: ITerminalSessionStatusChangedEvent): void;
  setFocusedSession(sessionId: string | null): void;
  getFocusedSessionId(): string | null;
}
export const ITerminalSessionNotifyService = createIdentifier<ITerminalSessionNotifyService>('rpc.terminal-session-notify-service');
