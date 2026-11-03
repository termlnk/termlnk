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
import type { IACPStreamEvent } from '../models/acp-event';
import type {
  IACPPromptBlock,
  IACPSessionInfo,
  ICreateACPSessionParams,
} from '../models/acp-session';
import { createIdentifier } from '@termlnk/core';

export interface IACPSessionService {
  readonly sessions$: Observable<IACPSessionInfo[]>;
  /** Synchronous snapshot of `sessions$`. */
  get sessions(): IACPSessionInfo[];

  createSession(params: ICreateACPSessionParams): Promise<IACPSessionInfo>;
  closeSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): IACPSessionInfo | undefined;

  prompt(sessionId: string, blocks: IACPPromptBlock[]): Promise<void>;
  cancel(sessionId: string): Promise<void>;

  respondPermission(sessionId: string, requestId: string, optionId: string): Promise<void>;

  setMode(sessionId: string, modeId: string): Promise<void>;
  setModel(sessionId: string, modelId: string): Promise<void>;

  /**
   * Structured event stream for one session. Does not replay history —
   * cold start uses loadSession inside createSession when a native id exists.
   */
  events$(sessionId: string): Observable<IACPStreamEvent>;

  /** Human-readable launch diagnostic for the "agent not working" flow. */
  diagnose(providerId: string): Promise<string>;
}

export const IACPSessionService = createIdentifier<IACPSessionService>(
  'acp.acp-session-service'
);
