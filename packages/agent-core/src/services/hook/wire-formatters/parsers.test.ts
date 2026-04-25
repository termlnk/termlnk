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

import { describe, expect, it } from 'vitest';
import { parseUniformQuestionSet } from './parse-question-helpers';

describe('parseUniformQuestionSet', () => {
  it('rejects malformed input', () => {
    expect(parseUniformQuestionSet({})).toBeNull();
    expect(parseUniformQuestionSet({ questions: [] })).toBeNull();
    expect(parseUniformQuestionSet({ questions: [null] })).toBeNull();
    expect(parseUniformQuestionSet({ questions: [{ id: 'q1' }] })).toBeNull();
  });

  it('parses a single question and synthesises idx-based id', () => {
    const result = parseUniformQuestionSet({
      questions: [{ question: 'Auth method?', header: 'Auth' }],
    });
    expect(result).not.toBeNull();
    expect(result!.questions).toHaveLength(1);
    expect(result!.questions[0]!.id).toBe('idx-0');
    expect(result!.questions[0]!.question).toBe('Auth method?');
    expect(result!.questions[0]!.header).toBe('Auth');
  });

  it('preserves agent-supplied id when present', () => {
    const result = parseUniformQuestionSet({
      questions: [{ id: 'q_abc', question: 'Pick env' }],
    });
    expect(result!.questions[0]!.id).toBe('q_abc');
  });

  it('parses multiple questions preserving order, falling back to idx for missing ids', () => {
    const result = parseUniformQuestionSet({
      questions: [
        { question: 'Q1', id: 'custom-a' },
        { question: 'Q2' },
      ],
    });
    expect(result!.questions).toHaveLength(2);
    expect(result!.questions[0]!.id).toBe('custom-a');
    expect(result!.questions[1]!.id).toBe('idx-1');
  });
});
