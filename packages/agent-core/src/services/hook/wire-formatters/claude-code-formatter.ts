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
import { denyReasonFor, joinAnswer, resolveQuestions } from './wire-formatter';

/**
 * Claude Code wire formatter.
 *
 * Two output shapes depending on the originating hook:
 *
 * - **AskUserQuestion (`PreToolUse` + matcher=AskUserQuestion, blocking)** —
 *   when the user submits one or more answers we emit
 *   `permissionDecision: "allow"` plus `updatedInput` echoing the original
 *   `questions` with an `answers` map keyed by each question's text.
 *   Claude Code then consumes the tool without ever opening the CLI TUI
 *   picker and the assistant proceeds as if the user had typed the choice.
 *
 *   Answers are rebuilt in the **original `questions` order** (tracked
 *   through {@link IAskUserQuestion.id}) rather than by looking up by raw
 *   question text, so two questions with the same phrasing don't collide
 *   and whitespace/case drift doesn't break the match.
 *
 * - **PermissionRequest (classic approval)** — we emit a top-level
 *   `hookSpecificOutput.decision.behavior` of allow or deny. `answer` is
 *   not a concept here; it degrades to deny + reason.
 */
export class ClaudeCodeWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, ctx: IWireFormatContext): string {
    if (ctx.isQuestion) {
      if (decision.kind === 'answer' || decision.kind === 'answers') {
        return formatAllowWithAnswers(decision, ctx);
      }
      // deny / allow on a question — deny maps to cancellation, allow has
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
}

type AnswerDecision = Extract<IPermissionDecision, { kind: 'answer' } | { kind: 'answers' }>;

function formatAllowWithAnswers(decision: AnswerDecision, ctx: IWireFormatContext): string {
  const updatedInput: Record<string, unknown> = {
    ...(ctx.toolInput ?? {}),
    answers: buildAnswersByText(decision, ctx),
  };
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput,
    },
  });
}

function buildAnswersByText(decision: AnswerDecision, ctx: IWireFormatContext): Record<string, string> {
  const questions = resolveQuestions(ctx);
  const out: Record<string, string> = {};

  if (decision.kind === 'answer') {
    const q0 = questions[0];
    if (q0) {
      out[q0.question] = decision.label;
    }
    return out;
  }

  for (const q of questions) {
    const entry = decision.answers[q.id];
    if (!entry) {
      continue;
    }
    const joined = joinAnswer(entry);
    if (joined.length > 0) {
      out[q.question] = joined;
    }
  }
  return out;
}
