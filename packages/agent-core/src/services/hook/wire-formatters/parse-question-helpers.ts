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

import type { IAskUserQuestion, IAskUserQuestionOption, IAskUserQuestionSet } from '@termlnk/agent';

/**
 * Normalise an option entry across agents. Accepts a plain string
 * (Cline-shape; also tolerant of malformed Claude inputs) or an object
 * with `label` / `description` / `preview` / `value` fields. Returns
 * `null` for shapes that cannot be interpreted (nullish, arrays,
 * objects with no extractable label).
 */
export function normaliseOption(raw: unknown): IAskUserQuestionOption | null {
  if (typeof raw === 'string') {
    return raw.length > 0 ? { label: raw } : null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const label = asOptionalString(rec.label) ?? asOptionalString(rec.value);
  if (!label) {
    return null;
  }
  const description = asOptionalString(rec.description);
  const preview = asOptionalString(rec.preview);
  return {
    label,
    ...(description !== undefined ? { description } : {}),
    ...(preview !== undefined ? { preview } : {}),
  };
}

/**
 * Map a raw array of option entries through {@link normaliseOption},
 * dropping entries that cannot be interpreted.
 */
export function extractOptions(raw: unknown): IAskUserQuestionOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: IAskUserQuestionOption[] = [];
  for (const entry of raw) {
    const opt = normaliseOption(entry);
    if (opt) {
      out.push(opt);
    }
  }
  return out;
}

/**
 * Shared shell for every AskUserQuestion-style parser: validates the
 * top-level `questions` array, delegates per-question parsing to
 * `parseOne`, and returns `null` when nothing parses.
 */
export function parseQuestionSet(
  toolInput: Record<string, unknown>,
  parseOne: (raw: unknown, index: number) => IAskUserQuestion | null
): IAskUserQuestionSet | null {
  const rawQuestions = toolInput.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return null;
  }
  const questions: IAskUserQuestion[] = [];
  for (const [index, raw] of rawQuestions.entries()) {
    const parsed = parseOne(raw, index);
    if (parsed) {
      questions.push(parsed);
    }
  }
  return questions.length === 0 ? null : { questions };
}

/**
 * Synthesise a stable question id when the agent does not provide one.
 * Position-based so answers key back by index rather than by raw
 * question text (which can collide across two same-text questions).
 */
export function synthesiseQuestionId(index: number): string {
  return `idx-${index}`;
}

/**
 * Strict boolean coercion — only literal `true` passes. Ignores string
 * `"true"` to avoid silent truthy coercion from half-baked payloads.
 */
export function asBoolean(value: unknown): boolean {
  return value === true;
}

/**
 * Extract a non-empty string, or `undefined`. Used for optional fields
 * like `header` / `id` so we never forward empty strings downstream.
 */
export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
