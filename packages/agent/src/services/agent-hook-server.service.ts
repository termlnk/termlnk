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
import type { IPendingInteractionPayload, IPermissionDecision } from '../models/agent-hook';
import { createIdentifier } from '@termlnk/core';

/**
 * Agent hook HTTP server service.
 * Receives hook events from external agents via HTTP callbacks.
 */
export interface IAgentHookServerService {
  /** Server port observable */
  readonly port$: Observable<number>;

  /** Bearer token for authentication */
  readonly token: string;

  /**
   * Pending blocking interactions awaiting a user decision — mixture of
   * plain approvals (`kind: 'permission'`) and multi-choice questions
   * (`kind: 'question'`). The union lets the UI render a single list and
   * the island derive a single CESP `InputRequired` event.
   */
  readonly pendingInteractions$: Observable<IPendingInteractionPayload[]>;

  /** Start the HTTP server on an ephemeral port */
  start(): Promise<void>;

  /** Stop the HTTP server */
  stop(): Promise<void>;

  /** Get the current listening port */
  getPort(): number;

  /** Respond to a pending permission request */
  respondPermission(requestId: string, decision: IPermissionDecision): void;

  /**
   * Forget any pending AskUserQuestion interaction whose originating
   * tool-use id matches `toolUseId`. Called from the monitor when a
   * post-tool-use event arrives — it's the signal that the CLI TUI
   * user answered directly (or the injected keystrokes landed), so the
   * island can close its picker. No-op when there's no match (idempotent).
   */
  dismissQuestionByToolUseId(toolUseId: string): void;

  /**
   * Enable or disable external-terminal monitoring. When enabled, the server
   * writes its `(port, token)` to `<configPath>/runtime.json` so agents running
   * in any terminal on this machine can discover it. When disabled, the file
   * is removed so only hooks inheriting `TERMLNK_HOOK_PORT` via a Termlnk
   * PTY can reach the server.
   *
   * The initial state is determined at startup; runtime toggles (e.g., user
   * flipping the setting) go through this method.
   */
  setExternalMonitorEnabled(enabled: boolean): Promise<void>;
}

export const IAgentHookServerService = createIdentifier<IAgentHookServerService>(
  'agent.agent-hook-server-service'
);
