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

import type { IPermissionDecision } from '@termlnk/agent';
import type { IAgentWireFormatter, IWireFormatContext } from './wire-formatter';
import { denyReasonFor } from './wire-formatter';

/**
 * Claude Code wire formatter.
 *
 * Two output shapes depending on the originating hook:
 *
 * - **AskUserQuestion (`PreToolUse` + matcher=AskUserQuestion, blocking)** —
 *   when the user picks an option we emit `permissionDecision: "allow"` plus
 *   `updatedInput` echoing the original `questions` with an `answers` map.
 *   Claude Code consumes the tool without ever opening the CLI TUI picker
 *   and the assistant proceeds as if the user had typed the choice.
 *
 * - **PermissionRequest (classic approval)** — we emit a top-level
 *   `hookSpecificOutput.decision.behavior` of allow or deny. `answer` is
 *   not a concept here; it degrades to deny + reason ("User selected: X"),
 *   preserving back-compat for the legacy AskUserQuestion-via-permission
 *   path that some users may still hit.
 */
export class ClaudeCodeWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, ctx: IWireFormatContext): string {
    if (ctx.isQuestion && ctx.question && decision.kind === 'answer') {
      return this._formatQuestionAnswer(decision.label, ctx.toolInput, ctx.question.question);
    }

    if (ctx.isQuestion) {
      // deny or allow on a question — deny maps to cancellation, allow has
      // no legitimate meaning so we degrade it too. Claude Code's
      // AskUserQuestion then exits with the denial reason surfaced to the
      // assistant as the tool_result.
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: denyReasonFor(decision),
        },
      });
    }

    const inner = decision.kind === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: denyReasonFor(decision) };
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: inner },
    });
  }

  /**
   * Build the PreToolUse "allow with updatedInput" payload. The answers map
   * is keyed by the question text — Claude Code matches it against the
   * `questions[].question` string, so echoing the raw toolInput back verbatim
   * (plus our `answers` field) is the safest shape.
   */
  private _formatQuestionAnswer(
    label: string,
    toolInput: Record<string, unknown> | undefined,
    questionText: string
  ): string {
    const updatedInput: Record<string, unknown> = {
      ...(toolInput ?? {}),
      answers: { [questionText]: label },
    };
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput,
      },
    });
  }
}
