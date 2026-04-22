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

import type { IAnswerMap, IAskUserQuestion, IAskUserQuestionSet } from '@termlnk/agent';
import { describe, expect, it } from 'vitest';
import { ClaudeCodeWireFormatter } from './claude-code-formatter';
import { CodexWireFormatter } from './codex-formatter';
import { KimiCodeWireFormatter } from './kimi-code-formatter';
import { OpenCodeWireFormatter } from './opencode-formatter';

function makeQuestion(overrides: Partial<IAskUserQuestion> & Pick<IAskUserQuestion, 'id' | 'question'>): IAskUserQuestion {
  return {
    id: overrides.id,
    question: overrides.question,
    header: overrides.header,
    options: overrides.options ?? [{ label: 'Yes' }],
    multiSelect: overrides.multiSelect,
    allowCustom: overrides.allowCustom,
    isSecret: overrides.isSecret,
  };
}

function set(...qs: IAskUserQuestion[]): IAskUserQuestionSet {
  return { questions: qs };
}

describe('ClaudeCodeWireFormatter', () => {
  const fmt = new ClaudeCodeWireFormatter();

  it('answer path returns updatedInput.answers keyed by question text', () => {
    const q = makeQuestion({ id: 'idx-0', question: 'Pick?', options: [{ label: 'A' }, { label: 'B' }] });
    const body = fmt.formatResponse(
      { kind: 'answer', label: 'A' },
      { isQuestion: true, toolInput: { questions: [{ question: 'Pick?' }] }, questionSet: set(q), question: q }
    );
    const parsed = JSON.parse(body);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(parsed.hookSpecificOutput.updatedInput.answers).toEqual({ 'Pick?': 'A' });
  });

  it('answers path joins multi-label answers and respects question order', () => {
    const q1 = makeQuestion({ id: 'idx-0', question: 'Features?', options: [{ label: 'A' }, { label: 'B' }], multiSelect: true });
    const q2 = makeQuestion({ id: 'idx-1', question: 'Extras?', options: [{ label: 'X' }] });
    const answers: IAnswerMap = {
      'idx-0': { labels: ['A', 'B'] },
      'idx-1': { labels: ['X'] },
    };
    const body = fmt.formatResponse(
      { kind: 'answers', answers },
      { isQuestion: true, toolInput: {}, questionSet: set(q1, q2) }
    );
    const parsed = JSON.parse(body);
    expect(parsed.hookSpecificOutput.updatedInput.answers).toEqual({
      'Features?': 'A, B',
      'Extras?': 'X',
    });
  });

  it('deny on question surfaces reason', () => {
    const q = makeQuestion({ id: 'idx-0', question: 'Q?' });
    const body = fmt.formatResponse(
      { kind: 'deny' },
      { isQuestion: true, toolInput: {}, questionSet: set(q) }
    );
    const parsed = JSON.parse(body);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toMatch(/Denied/);
  });
});

describe('CodexWireFormatter', () => {
  const fmt = new CodexWireFormatter();

  it('encodes answers by native id', () => {
    const q1 = makeQuestion({ id: 'q_abc', question: 'Env?' });
    const q2 = makeQuestion({ id: 'q_def', question: 'Token?', isSecret: true, options: [] });
    const answers: IAnswerMap = {
      q_abc: { labels: ['dev'] },
      q_def: { labels: [], custom: 'sk-xxxxx' },
    };
    const body = fmt.formatResponse(
      { kind: 'answers', answers },
      { isQuestion: true, toolInput: {}, questionSet: set(q1, q2) }
    );
    const parsed = JSON.parse(body);
    expect(parsed.answers).toEqual({
      q_abc: { answers: ['dev'] },
      q_def: { answers: ['sk-xxxxx'] },
    });
  });

  it('allow without question context = empty body', () => {
    const body = fmt.formatResponse({ kind: 'allow' }, { isQuestion: false });
    expect(body).toBe('{}');
  });

  it('deny without question falls back to block shape', () => {
    const body = fmt.formatResponse({ kind: 'deny' }, { isQuestion: false });
    const parsed = JSON.parse(body);
    expect(parsed.decision).toBe('block');
  });
});

describe('OpenCodeWireFormatter', () => {
  const fmt = new OpenCodeWireFormatter();

  it('encodes answers as string[][] preserving order', () => {
    const q1 = makeQuestion({ id: 'idx-0', question: 'Q1' });
    const q2 = makeQuestion({ id: 'idx-1', question: 'Q2' });
    const q3 = makeQuestion({ id: 'idx-2', question: 'Q3' });
    const answers: IAnswerMap = {
      'idx-0': { labels: ['A'] },
      'idx-2': { labels: ['C'], custom: 'D' },
    };
    const body = fmt.formatResponse(
      { kind: 'answers', answers },
      { isQuestion: true, toolInput: {}, questionSet: set(q1, q2, q3) }
    );
    const parsed = JSON.parse(body);
    expect(parsed.answers).toEqual([['A'], [], ['C', 'D']]);
  });
});

describe('KimiCodeWireFormatter', () => {
  const fmt = new KimiCodeWireFormatter();

  it('encodes answers map keyed by question text', () => {
    const q = makeQuestion({ id: 'idx-0', question: 'Pick?', options: [{ label: 'A' }] });
    const answers: IAnswerMap = { 'idx-0': { labels: ['A'] } };
    const body = fmt.formatResponse(
      { kind: 'answers', answers },
      { isQuestion: true, toolInput: {}, questionSet: set(q) }
    );
    const parsed = JSON.parse(body);
    expect(parsed.answers).toEqual({ 'Pick?': ['A'] });
  });
});
