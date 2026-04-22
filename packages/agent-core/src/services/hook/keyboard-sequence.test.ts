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

import type { IAskUserQuestion, IAskUserQuestionSet, IPermissionDecision } from '@termlnk/agent';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { buildQuestionSetSequence } from './keyboard-sequence';

function q(
  id: string,
  options: readonly string[],
  extra: Partial<IAskUserQuestion> = {}
): IAskUserQuestion {
  return {
    id,
    question: `Q ${id}`,
    options: options.map((label) => ({ label })),
    ...extra,
  };
}

function set(...questions: IAskUserQuestion[]): IAskUserQuestionSet {
  return { questions };
}

function enc(text: string): string {
  return `TEXT:${Buffer.from(text, 'utf8').toString('base64')}`;
}

describe('buildQuestionSetSequence', () => {
  it('returns null for allow / deny (never an injectable decision)', () => {
    const s = set(q('q1', ['A', 'B']));
    expect(buildQuestionSetSequence(s, { kind: 'allow' })).toBeNull();
    expect(buildQuestionSetSequence(s, { kind: 'deny' })).toBeNull();
  });

  it('returns null when any question is isSecret', () => {
    const s = set(q('tok', [], { isSecret: true }));
    const decision: IPermissionDecision = { kind: 'answers', answers: { tok: { labels: [], custom: 'abc' } } };
    expect(buildQuestionSetSequence(s, decision)).toBeNull();
  });

  it('single-question single-select → DOWN×idx + ENTER (kind: answer)', () => {
    const s = set(q('q1', ['A', 'B', 'C']));
    const seq = buildQuestionSetSequence(s, { kind: 'answer', label: 'C' });
    expect(seq).toBe('DOWN DOWN ENTER');
  });

  it('single-question single-select first-option → ENTER only', () => {
    const s = set(q('q1', ['A', 'B']));
    const seq = buildQuestionSetSequence(s, { kind: 'answer', label: 'A' });
    expect(seq).toBe('ENTER');
  });

  it('single-question single-select with kind: answers maps by label', () => {
    const s = set(q('q1', ['A', 'B', 'C']));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: ['B'] } },
    });
    expect(seq).toBe('DOWN ENTER');
  });

  it('single-question single-select with custom → moves to Other slot and types', () => {
    const s = set(q('q1', ['A', 'B'], { allowCustom: true }));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: [], custom: 'hello' } },
    });
    // DOWN to Other (idx 2), ENTER (enter input), TEXT, ENTER (commit)
    expect(seq).toBe(`DOWN DOWN ENTER ${enc('hello')} ENTER`);
  });

  it('multi-select toggles each selected option with SPACE and lands on Next', () => {
    const s = set(q('q1', ['A', 'B', 'C', 'D'], { multiSelect: true }));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: ['B', 'D'] } },
    });
    // DOWN to B (1), SPACE, DOWN DOWN to D (3), SPACE, DOWN to Next (4), ENTER
    expect(seq).toBe('DOWN SPACE DOWN DOWN SPACE DOWN ENTER');
  });

  it('multi-select with custom types custom after toggles, then Next', () => {
    const s = set(q('q1', ['A', 'B'], { multiSelect: true, allowCustom: true }));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: ['A'], custom: 'xyz' } },
    });
    // A at 0: SPACE (cursor=0); DOWN DOWN to Other slot (2): ENTER + TEXT + ENTER; DOWN to Next (3): ENTER
    expect(seq).toBe(`SPACE DOWN DOWN ENTER ${enc('xyz')} ENTER DOWN ENTER`);
  });

  it('multi-question chains sequences in order', () => {
    const s = set(
      q('q1', ['A', 'B'], { multiSelect: true }),
      q('q2', ['X', 'Y', 'Z']),
    );
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: {
        q1: { labels: ['A', 'B'] },
        q2: { labels: ['Z'] },
      },
    });
    // q1: SPACE (A), DOWN SPACE (B at 1), DOWN to Next (2), ENTER
    // q2: DOWN DOWN ENTER (Z)
    expect(seq).toBe('SPACE DOWN SPACE DOWN ENTER DOWN DOWN ENTER');
  });

  it('empty single-select answer emits an ENTER so the TUI surfaces its validator', () => {
    const s = set(q('q1', ['A', 'B']));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: [] } },
    });
    expect(seq).toBe('ENTER');
  });

  it('unknown label in answer degrades to empty (ENTER for validation)', () => {
    const s = set(q('q1', ['A', 'B']));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answer',
      label: 'Nonexistent',
    });
    expect(seq).toBe('ENTER');
  });

  it('encodes custom text as base64 so spaces and unicode survive', () => {
    const s = set(q('q1', ['A'], { multiSelect: true, allowCustom: true }));
    const seq = buildQuestionSetSequence(s, {
      kind: 'answers',
      answers: { q1: { labels: [], custom: '你 好' } },
    });
    expect(seq).toContain(enc('你 好'));
    // Base64 of UTF-8 "你 好" does not contain raw whitespace.
    const b64 = Buffer.from('你 好', 'utf8').toString('base64');
    expect(b64).not.toMatch(/\s/);
  });
});
