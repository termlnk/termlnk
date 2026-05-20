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
import type { IRemoteSessionEnv } from './platform-context.service';
import { createIdentifier } from '@termlnk/core';

export interface IRemoteSessionEnvChange {
  sessionId: string;
  env: IRemoteSessionEnv;
}

/**
 * Per-session remote env reported via OSC 633;P. Contract sits in @termlnk/agent
 * so agent-core consumes it via DI without depending on rpc-server internals.
 */
export interface ITerminalSessionEnvService {
  /** Fires whenever any env field for a session changes. */
  readonly env$: Observable<IRemoteSessionEnvChange>;

  /** Latest known env for a session. Empty fields until the shell reports. */
  getEnv(sessionId: string): IRemoteSessionEnv;
}

export const ITerminalSessionEnvService = createIdentifier<ITerminalSessionEnvService>(
  'agent.terminal-session-env-service'
);
