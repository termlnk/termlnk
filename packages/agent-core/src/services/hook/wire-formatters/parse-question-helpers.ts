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

import type { IAskUserQuestion, IAskUserQuestionSet } from '@termlnk/agent';

/**
 * Parse the AskUserQuestion-style tool input shared by Claude Code, Codex,
 * Kimi Code and OpenCode. The 4 agents all use the same `{ questions: [...] }`
 * shape with `id?`, `question`, `header?`; the island only needs identification
 * so we drop options / multiSelect / isSecret. Returns `null` when nothing
 * parses.
 */
export function parseUniformQuestionSet(
  toolInput: Record<string, unknown>
): IAskUserQuestionSet | null {
  const rawQuestions = toolInput.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return null;
  }
  const questions: IAskUserQuestion[] = [];
  for (const [index, raw] of rawQuestions.entries()) {
    const parsed = parseOneQuestion(raw, index);
    if (parsed) {
      questions.push(parsed);
    }
  }
  return questions.length === 0 ? null : { questions };
}

function parseOneQuestion(raw: unknown, index: number): IAskUserQuestion | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const questionText = asOptionalString(rec.question);
  if (!questionText) {
    return null;
  }
  return {
    id: asOptionalString(rec.id) ?? `idx-${index}`,
    question: questionText,
    header: asOptionalString(rec.header),
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
