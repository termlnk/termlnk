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
import { collectAnswerValues, formatGenericFallback, resolveQuestions } from './wire-formatter';

/**
 * Kimi Code wire formatter.
 *
 * Kimi's `AskUserQuestion` tool documents its return shape as
 * `{ answers: { [questionText]: string[] } }` — similar to Claude Code's
 * `updatedInput.answers` but wrapped at the top level rather than inside
 * a hook-specific output envelope.
 *
 * Kimi's hook command itself is fire-and-forget (see
 * `KimiCodeHookAdapter`), so this body is only relevant when the island
 * blocks as the sole responder — in which case the helper streams it back
 * to stdout and the agent consumes it as the tool result.
 */
export class KimiCodeWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, ctx: IWireFormatContext): string {
    if (ctx.isQuestion && (decision.kind === 'answer' || decision.kind === 'answers')) {
      return JSON.stringify({ answers: buildAnswersByText(decision, ctx) });
    }
    return formatGenericFallback(decision);
  }
}

type AnswerDecision = Extract<IPermissionDecision, { kind: 'answer' } | { kind: 'answers' }>;

function buildAnswersByText(
  decision: AnswerDecision,
  ctx: IWireFormatContext
): Record<string, string[]> {
  const questions = resolveQuestions(ctx);
  const out: Record<string, string[]> = {};

  if (decision.kind === 'answer') {
    const q0 = questions[0];
    if (q0) {
      out[q0.question] = [decision.label];
    }
    return out;
  }

  for (const q of questions) {
    const entry = decision.answers[q.id];
    if (!entry) {
      continue;
    }
    const values = collectAnswerValues(entry);
    if (values.length > 0) {
      out[q.question] = values;
    }
  }
  return out;
}
