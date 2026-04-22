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

import type { IAnswerMap, IAskUserQuestionSet, IPermissionDecision } from '@termlnk/agent';
import { Buffer } from 'node:buffer';

const DOWN = 'DOWN';
const ENTER = 'ENTER';
const SPACE = 'SPACE';

/**
 * Build the keyboard-injection token sequence that drives Claude Code's
 * CLI AskUserQuestion TUI through the user's full decision from the
 * Dynamic Island.
 *
 * Assumed Claude Code TUI key grammar (confirmed via on-screen hints
 * `Enter to select · Tab/Arrow keys to navigate · Esc to cancel`):
 *
 * - Cursor starts on option 0 at the top of every question turn.
 * - `DOWN` moves one row within the current question (option list).
 * - `SPACE` toggles the current option's checkbox in multi-select mode
 *   (plain checkbox idiom that `ink` TUIs follow).
 * - `ENTER` in single-select mode commits the highlighted option and
 *   auto-advances to the next question.
 * - `ENTER` in multi-select mode — when pressed on the "Next / Submit"
 *   slot that follows all options (and the optional Other slot) —
 *   advances to the next question or submits the whole set.
 * - "Other…" slot sits at `options.length`; pressing ENTER there opens
 *   an inline text input, a UTF-8 `TEXT:<base64>` block types the
 *   custom text, and a closing ENTER commits and returns focus to the
 *   question's option list.
 *
 * Returns `null` when the decision includes a shape the injector refuses
 * to express:
 *
 * - `isSecret` prompts — passwords/tokens stay in the CLI where they
 *   cannot leak through accessibility bridges or on-screen mirrors.
 * - Non-answer decisions — `allow`/`deny` never reach this builder.
 */
export function buildQuestionSetSequence(
  questionSet: IAskUserQuestionSet,
  decision: IPermissionDecision,
): string | null {
  if (decision.kind !== 'answer' && decision.kind !== 'answers') {
    return null;
  }

  const questions = questionSet.questions;
  if (questions.length === 0) {
    return null;
  }

  for (const q of questions) {
    if (q.isSecret === true) {
      return null;
    }
  }

  const answerMap: IAnswerMap = decision.kind === 'answer'
    ? { [questions[0]!.id]: { labels: [decision.label] } }
    : decision.answers;

  const tokens: string[] = [];
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]!;
    const entry = answerMap[q.id] ?? { labels: [] };
    const options = q.options;
    const allowCustom = q.allowCustom === true;
    const hasCustom = typeof entry.custom === 'string' && entry.custom.length > 0;
    const isMulti = q.multiSelect === true;

    let cursor = 0;

    if (!isMulti) {
      // Single-select: pick the first predefined label, or fall through
      // to the Other slot for a free-text answer.
      const label = entry.labels[0];
      const labelIdx = label ? options.findIndex((o) => o.label === label) : -1;
      if (labelIdx >= 0) {
        pushMoves(tokens, labelIdx - cursor);
        tokens.push(ENTER);
        continue;
      }
      if (hasCustom && allowCustom) {
        const otherIdx = options.length;
        pushMoves(tokens, otherIdx - cursor);
        tokens.push(ENTER);
        tokens.push(encodeText(entry.custom!));
        tokens.push(ENTER);
        continue;
      }
      // Empty answer — nothing we can type. Emit an ENTER so the TUI
      // at least advances (Claude Code rejects zero-answer questions,
      // so the user will see the validation error in the CLI and can
      // retry).
      tokens.push(ENTER);
      continue;
    }

    // Multi-select: toggle each selected predefined label.
    const labelIndices = entry.labels
      .map((lbl) => options.findIndex((o) => o.label === lbl))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    for (const idx of labelIndices) {
      pushMoves(tokens, idx - cursor);
      cursor = idx;
      tokens.push(SPACE);
    }

    if (hasCustom && allowCustom) {
      const otherIdx = options.length;
      pushMoves(tokens, otherIdx - cursor);
      cursor = otherIdx;
      tokens.push(ENTER);
      tokens.push(encodeText(entry.custom!));
      tokens.push(ENTER);
    }

    // Land on the trailing "Next / Submit" slot and press ENTER to
    // advance the turn. The slot sits one row below the last option,
    // plus another row when the Other slot is present.
    const nextIdx = options.length + (allowCustom ? 1 : 0);
    pushMoves(tokens, nextIdx - cursor);
    tokens.push(ENTER);
  }

  return tokens.join(' ');
}

function pushMoves(tokens: string[], count: number): void {
  if (count <= 0) {
    return;
  }
  for (let i = 0; i < count; i++) {
    tokens.push(DOWN);
  }
}

function encodeText(value: string): string {
  return `TEXT:${Buffer.from(value, 'utf8').toString('base64')}`;
}
