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
 * Codex CLI wire formatter.
 *
 * Codex's `request_user_input` tool (see
 * `codex-rs/protocol/src/request_user_input.rs`) expects a response of
 * shape `{ answers: { [id]: { answers: string[] } } }` keyed by the
 * question's native id. The id round-trips through parser → view →
 * decision → here unchanged.
 *
 * Custom ("Other") and secret text inputs are appended to the
 * `answers[id].answers` list as the final entry, matching Codex's
 * documented handling of free-text answers.
 *
 * allow / deny with no question context fall through to the generic
 * `{ decision: 'block', reason }` shape.
 */
export class CodexWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, ctx: IWireFormatContext): string {
    if (ctx.isQuestion && (decision.kind === 'answer' || decision.kind === 'answers')) {
      return JSON.stringify({ answers: buildAnswersById(decision, ctx) });
    }
    return formatGenericFallback(decision);
  }
}

type AnswerDecision = Extract<IPermissionDecision, { kind: 'answer' } | { kind: 'answers' }>;

function buildAnswersById(
  decision: AnswerDecision,
  ctx: IWireFormatContext
): Record<string, { answers: string[] }> {
  const questions = resolveQuestions(ctx);
  const out: Record<string, { answers: string[] }> = {};

  if (decision.kind === 'answer') {
    const q0 = questions[0];
    if (q0) {
      out[q0.id] = { answers: [decision.label] };
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
      out[q.id] = { answers: values };
    }
  }
  return out;
}
