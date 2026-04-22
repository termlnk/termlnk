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
import { asOptionalString, extractOptions, parseQuestionSet, readMultiSelect, synthesiseQuestionId } from './parse-question-helpers';

/**
 * Parse Claude Code's `AskUserQuestion` tool input (1-4 questions, each
 * with up to 4 options, plus optional `multiSelect` and per-option
 * HTML/Markdown `preview` snippets from the TS SDK's `previewFormat`
 * config). Kimi sends the same shape but spells multi-pick
 * `multi_select` — Kimi has its own parser.
 */
export function parseClaudeAskUserQuestion(
  toolInput: Record<string, unknown>
): IAskUserQuestionSet | null {
  return parseQuestionSet(toolInput, parseOneQuestion);
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
  const options = extractOptions(rec.options);
  if (options.length === 0) {
    return null;
  }
  return {
    id: asOptionalString(rec.id) ?? synthesiseQuestionId(index),
    question: questionText,
    header: asOptionalString(rec.header),
    options,
    multiSelect: readMultiSelect(rec, 'multiSelect', 'multi_select', 'multiselect'),
  };
}
