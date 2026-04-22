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
 * Parse Codex CLI's `request_user_input` (see
 * `codex-rs/protocol/src/request_user_input.rs`). Codex is always
 * single-pick; `isOther` → `allowCustom`, `isSecret` → `isSecret`. The
 * server-authoritative `id` is preserved so {@link CodexWireFormatter}
 * can round-trip it as the response's `answers[id].answers` key.
 */
export function parseCodexRequestUserInput(
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
  const isSecret = asBoolean(rec.isSecret);
  const allowCustom = asBoolean(rec.isOther) || isSecret;
  const options = extractOptions(rec.options);
  // Secret prompts typically have no predefined options — accept if
  // either options exist OR the secret flag forces a free-text field.
  if (options.length === 0 && !isSecret) {
    return null;
  }
  return {
    id: asOptionalString(rec.id) ?? synthesiseQuestionId(index),
    question: questionText,
    header: asOptionalString(rec.header),
    options,
    allowCustom,
    isSecret,
  };
}
