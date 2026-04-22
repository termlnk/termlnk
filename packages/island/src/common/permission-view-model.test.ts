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

import type { IAskUserQuestion, IAskUserQuestionRequestPayload } from '@termlnk/agent';
import { describe, expect, it } from 'vitest';
import { deriveQuestionFacets, toQuestionViewModel } from './permission-view-model';

function makeRequest(questions: IAskUserQuestion[]): IAskUserQuestionRequestPayload {
  const first = questions[0]!;
  return {
    kind: 'question',
    requestId: 'req-1',
    toolName: 'AskUserQuestion',
    toolInput: {},
    terminalSessionId: 'sess-1',
    agent: 'claude-code',
    source: 'internal',
    timestamp: 0,
    questionSet: { questions },
    question: first,
  };
}

describe('deriveQuestionFacets', () => {
  it('reads plain single-select', () => {
    const f = deriveQuestionFacets({
      id: 'q', question: 'Q?', options: [{ label: 'A' }],
    });
    expect(f).toEqual({ isMultiSelect: false, hasCustomSlot: false, isSecret: false });
  });

  it('flags multiSelect', () => {
    const f = deriveQuestionFacets({
      id: 'q', question: 'Q?', options: [{ label: 'A' }], multiSelect: true,
    });
    expect(f.isMultiSelect).toBe(true);
  });

  it('flags hasCustomSlot when allowCustom', () => {
    const f = deriveQuestionFacets({
      id: 'q', question: 'Q?', options: [{ label: 'A' }], allowCustom: true,
    });
    expect(f.hasCustomSlot).toBe(true);
    expect(f.isSecret).toBe(false);
  });

  it('flags hasCustomSlot when isSecret (even without allowCustom)', () => {
    const f = deriveQuestionFacets({
      id: 'q', question: 'Token?', options: [], isSecret: true,
    });
    expect(f.hasCustomSlot).toBe(true);
    expect(f.isSecret).toBe(true);
  });
});

describe('toQuestionViewModel', () => {
  it('Claude single-question single-select → quick-path', () => {
    const vm = toQuestionViewModel(makeRequest([{
      id: 'q', question: 'Pick?', options: [{ label: 'A' }, { label: 'B' }],
    }]));
    expect(vm.isQuickPath).toBe(true);
    expect(vm.isMultiQuestion).toBe(false);
    expect(vm.anyMultiSelect).toBe(false);
    expect(vm.anyCustomSlot).toBe(false);
  });

  it('Claude multiSelect disables quick-path', () => {
    const vm = toQuestionViewModel(makeRequest([{
      id: 'q', question: 'Features?', multiSelect: true,
      options: [{ label: 'A' }, { label: 'B' }],
    }]));
    expect(vm.isQuickPath).toBe(false);
    expect(vm.anyMultiSelect).toBe(true);
  });

  it('Kimi allowCustom always disables quick-path', () => {
    const vm = toQuestionViewModel(makeRequest([{
      id: 'q', question: 'Pick?', allowCustom: true,
      options: [{ label: 'A' }],
    }]));
    expect(vm.isQuickPath).toBe(false);
    expect(vm.anyCustomSlot).toBe(true);
  });

  it('Codex secret prompt disables quick-path and flags custom slot', () => {
    const vm = toQuestionViewModel(makeRequest([{
      id: 'q_tok', question: 'Token?', isSecret: true, options: [],
    }]));
    expect(vm.isQuickPath).toBe(false);
    expect(vm.anyCustomSlot).toBe(true);
  });

  it('OpenCode multi-question (mix of multiSelect and single-select) disables quick-path', () => {
    const vm = toQuestionViewModel(makeRequest([
      { id: 'q1', question: 'Langs?', multiSelect: true, options: [{ label: 'Go' }, { label: 'Rust' }] },
      { id: 'q2', question: 'OS?', options: [{ label: 'macOS' }, { label: 'Linux' }] },
    ]));
    expect(vm.isQuickPath).toBe(false);
    expect(vm.isMultiQuestion).toBe(true);
    expect(vm.totalQuestions).toBe(2);
    expect(vm.anyMultiSelect).toBe(true);
  });
});
