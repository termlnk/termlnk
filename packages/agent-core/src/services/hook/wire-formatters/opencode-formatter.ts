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
 * OpenCode wire formatter.
 *
 * OpenCode's `question` tool returns `answers: string[][]` — outer array
 * is per-question in the original send order; inner array is the selected
 * labels (plus free-text at the end when `allowCustom`). Questions the
 * user skipped become empty inner arrays so indices line up with the input.
 *
 * Hook approvals without a question context fall through to the same shape
 * the {@link GenericWireFormatter} uses.
 */
export class OpenCodeWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision, ctx: IWireFormatContext): string {
    if (ctx.isQuestion && (decision.kind === 'answer' || decision.kind === 'answers')) {
      return JSON.stringify({ answers: buildAnswersInOrder(decision, ctx) });
    }
    return formatGenericFallback(decision);
  }
}

type AnswerDecision = Extract<IPermissionDecision, { kind: 'answer' } | { kind: 'answers' }>;

function buildAnswersInOrder(decision: AnswerDecision, ctx: IWireFormatContext): string[][] {
  const questions = resolveQuestions(ctx);
  if (decision.kind === 'answer') {
    return questions.map((_, i) => (i === 0 ? [decision.label] : []));
  }
  return questions.map((q) => {
    const entry = decision.answers[q.id];
    return entry ? collectAnswerValues(entry) : [];
  });
}
