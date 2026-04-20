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

import type { IAskUserQuestion, IAskUserQuestionOption } from '@termlnk/agent';

/**
 * Parse a Claude Code-style `AskUserQuestion` tool input into the unified
 * `IAskUserQuestion` contract. Other agents that reuse the same input shape
 * (Kimi / OpenCode if extended) can call straight into this helper.
 *
 * Claude Code's AskUserQuestion accepts 1–4 questions but the island only
 * ever renders the first — honour that here so every adapter produces a
 * consistent picker payload.
 */
export function parseClaudeAskUserQuestion(
  toolInput: Record<string, unknown>
): IAskUserQuestion | null {
  const questions = toolInput.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  const first = questions[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== 'object') {
    return null;
  }

  const questionText = typeof first.question === 'string' ? first.question : undefined;
  if (!questionText) {
    return null;
  }

  const rawOptions = first.options;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    return null;
  }

  const options: IAskUserQuestionOption[] = rawOptions
    .map((opt): IAskUserQuestionOption | null => {
      if (typeof opt === 'string') {
        return { label: opt };
      }
      if (opt && typeof opt === 'object') {
        const rec = opt as Record<string, unknown>;
        const label = typeof rec.label === 'string' ? rec.label : String(rec);
        return {
          label,
          description: typeof rec.description === 'string' ? rec.description : undefined,
        };
      }
      return null;
    })
    .filter((o): o is IAskUserQuestionOption => o !== null);

  if (options.length === 0) {
    return null;
  }

  return {
    question: questionText,
    header: typeof first.header === 'string' ? first.header : undefined,
    options,
  };
}
