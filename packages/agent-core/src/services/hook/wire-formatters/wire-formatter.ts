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

import type { IAskUserQuestion, IPermissionDecision } from '@termlnk/agent';

/**
 * Context handed to {@link IAgentWireFormatter.formatResponse}.
 *
 * `isQuestion` flips on when the originating request was an AskUserQuestion-
 * style picker. Formatters that support native answer injection (Claude
 * Code's `PreToolUse.updatedInput.answers`) must branch on this flag;
 * formatters without native support fall back to encoding the label as a
 * deny-with-message so the assistant reads it as a tool_result.
 */
export interface IWireFormatContext {
  readonly isQuestion: boolean;
  readonly toolInput?: Record<string, unknown>;
  readonly question?: IAskUserQuestion;
}

/**
 * Serialises a user's pending-interaction decision into the response body
 * the agent's hook runtime expects on stdout. Kept as a plain class so the
 * adapter that owns this wire knowledge can inject it into the shared base
 * adapter without pulling in a DI container.
 */
export interface IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, context: IWireFormatContext): string;
}

/**
 * Shared deny reason builder — formatters that encode "answer" as a deny
 * response reuse this so the CLI tool_result reads consistently across
 * agents.
 */
export function denyReasonFor(decision: IPermissionDecision): string {
  if (decision.kind === 'answer') {
    return `User selected: ${decision.label}`;
  }
  return 'Denied by user in Termlnk';
}
