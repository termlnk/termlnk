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

import type { IAnswerEntry, IAnswerMap, IAskUserQuestion, IAskUserQuestionSet, IPermissionDecision } from '@termlnk/agent';

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
  /** @deprecated Use `questionSet.questions[0]`. */
  readonly question?: IAskUserQuestion;
  /** Full picker payload — preferred. */
  readonly questionSet?: IAskUserQuestionSet;
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
  if (decision.kind === 'answers') {
    const summary = summariseAnswerMap(decision.answers);
    return summary.length > 0 ? `User selected: ${summary}` : 'Denied by user in Termlnk';
  }
  return 'Denied by user in Termlnk';
}

/**
 * Resolve the effective set of questions carried in the context, preferring
 * the new `questionSet` carrier but falling back to the single-question
 * alias during the rollout window.
 */
export function resolveQuestions(context: IWireFormatContext): readonly IAskUserQuestion[] {
  if (context.questionSet) {
    return context.questionSet.questions;
  }
  if (context.question) {
    return [context.question];
  }
  return [];
}

/**
 * Flatten an {@link IAnswerEntry} to a list of strings — predefined
 * labels followed by the optional free-text value. Used by the Codex /
 * OpenCode / Kimi formatters that emit `string[]` answer shapes.
 */
export function collectAnswerValues(entry: IAnswerEntry): string[] {
  const values = [...entry.labels];
  if (typeof entry.custom === 'string' && entry.custom.length > 0) {
    values.push(entry.custom);
  }
  return values;
}

/** Flatten an answer entry into a display string (`A, B`, `custom`, …). */
export function joinAnswer(entry: IAnswerEntry): string {
  return collectAnswerValues(entry).join(', ');
}

/**
 * Lowest-common-denominator fallback used by formatters when the decision
 * is not an AskUserQuestion-style answer. `allow` → `{}`; everything else
 * → `{ decision: 'block', reason }`.
 */
export function formatGenericFallback(decision: IPermissionDecision): string {
  if (decision.kind === 'allow') {
    return '{}';
  }
  return JSON.stringify({ decision: 'block', reason: denyReasonFor(decision) });
}

function summariseAnswerMap(answers: IAnswerMap): string {
  return Object.values(answers)
    .map(joinAnswer)
    .filter((s) => s.length > 0)
    .join('; ');
}
