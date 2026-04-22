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
import { asBoolean, asOptionalString, extractOptions, parseQuestionSet, synthesiseQuestionId } from './parse-question-helpers';

/**
 * Parse opencode's `question` tool (`packages/opencode/src/tool/question.ts`).
 * `multiple` maps to `multiSelect`; the server auto-adds a free-text slot,
 * so `allowCustom` defaults to `true` unless the tool input explicitly
 * disables it via `custom: false`.
 */
export function parseOpenCodeQuestion(
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
    multiSelect: asBoolean(rec.multiple),
    allowCustom: rec.custom !== false,
  };
}
