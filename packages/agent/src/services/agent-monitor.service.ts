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
import type { ExternalAgentType, IAgentHookEvent, IExternalAgentSession } from '../models/agent-hook';
import { createIdentifier } from '@termlnk/core';

export interface IAgentMonitorService {
  /** All currently tracked external agent sessions */
  readonly sessions$: Observable<IExternalAgentSession[]>;

  /** Stream of incoming hook events */
  readonly hookEvent$: Observable<IAgentHookEvent>;

  /** Process an incoming hook event */
  handleHookEvent(event: IAgentHookEvent): void;

  /** Get the current session for a terminal session ID */
  getSession(terminalSessionId: string): IExternalAgentSession | undefined;

  /** Get all active sessions */
  getSessions(): IExternalAgentSession[];

  /** Remove a tracked session (e.g., when PTY closes) */
  removeSession(terminalSessionId: string): void;

  /** Get the human-readable display name for an agent type */
  getDisplayName(agent: ExternalAgentType): string;

  /** Get sessions filtered by a specific agent type */
  getSessionsByAgent(agent: ExternalAgentType): IExternalAgentSession[];

  /** Called when a permission request is resolved (approved/denied/timed out) */
  onPermissionResolved(terminalSessionId: string): void;
}

export const IAgentMonitorService = createIdentifier<IAgentMonitorService>(
  'agent.agent-monitor-service'
);
