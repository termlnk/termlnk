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
import { parseClaudeAskUserQuestion } from './ask-user-question-parser';
import { parseCodexRequestUserInput } from './codex-request-user-input-parser';
import { parseKimiAskUserQuestion } from './kimi-ask-user-question-parser';
import { parseOpenCodeQuestion } from './opencode-question-parser';

describe('parseClaudeAskUserQuestion', () => {
  it('rejects malformed input', () => {
    expect(parseClaudeAskUserQuestion({})).toBeNull();
    expect(parseClaudeAskUserQuestion({ questions: [] })).toBeNull();
    expect(parseClaudeAskUserQuestion({ questions: [null] })).toBeNull();
    expect(parseClaudeAskUserQuestion({ questions: [{ question: 'Q?' }] })).toBeNull();
  });

  it('parses a single single-select question', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{
        question: 'Auth method?',
        header: 'Auth',
        options: [
          { label: 'OAuth', description: 'Recommended' },
          { label: 'JWT' },
        ],
      }],
    });
    expect(result).not.toBeNull();
    expect(result!.questions).toHaveLength(1);
    expect(result!.questions[0]!.id).toBe('idx-0');
    expect(result!.questions[0]!.header).toBe('Auth');
    expect(result!.questions[0]!.multiSelect).toBe(false);
    expect(result!.questions[0]!.options).toHaveLength(2);
    expect(result!.questions[0]!.options[0]!.description).toBe('Recommended');
  });

  it('parses multi-question with multiSelect and preview', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [
        {
          question: 'Which features?',
          multiSelect: true,
          options: [
            { label: 'A', preview: '<p>A preview</p>' },
            { label: 'B' },
          ],
        },
        { question: 'Any extras?', options: [{ label: 'Yes' }] },
      ],
    });
    expect(result!.questions).toHaveLength(2);
    expect(result!.questions[0]!.multiSelect).toBe(true);
    expect(result!.questions[0]!.options[0]!.preview).toBe('<p>A preview</p>');
    expect(result!.questions[1]!.id).toBe('idx-1');
  });

  it('tolerates string-shaped options as fallback', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{ question: 'Q?', options: ['Yes', 'No'] }],
    });
    expect(result!.questions[0]!.options).toEqual([{ label: 'Yes' }, { label: 'No' }]);
  });
});

describe('parseCodexRequestUserInput', () => {
  it('preserves native id', () => {
    const result = parseCodexRequestUserInput({
      questions: [{
        id: 'q_abc',
        question: 'Pick env',
        header: 'Env',
        options: [{ label: 'dev', description: 'Development' }],
      }],
    });
    expect(result!.questions[0]!.id).toBe('q_abc');
  });

  it('maps isOther/isSecret to allowCustom/isSecret', () => {
    const result = parseCodexRequestUserInput({
      questions: [
        { id: 'q1', question: 'Q?', options: [{ label: 'A' }], isOther: true },
        { id: 'q2', question: 'Token?', options: [], isSecret: true },
      ],
    });
    expect(result!.questions[0]!.allowCustom).toBe(true);
    expect(result!.questions[1]!.isSecret).toBe(true);
    expect(result!.questions[1]!.allowCustom).toBe(true);
  });

  it('rejects question with no options and no secret', () => {
    const result = parseCodexRequestUserInput({
      questions: [{ id: 'q', question: 'Q?' }],
    });
    expect(result).toBeNull();
  });
});

describe('parseKimiAskUserQuestion', () => {
  it('maps multi_select (snake_case) to multiSelect', () => {
    const result = parseKimiAskUserQuestion({
      questions: [{
        question: 'Features?',
        multi_select: true,
        options: [{ label: 'A' }, { label: 'B' }],
      }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
    // Kimi auto-adds custom so allowCustom is always on
    expect(result!.questions[0]!.allowCustom).toBe(true);
  });
});

describe('parseOpenCodeQuestion', () => {
  it('maps multiple to multiSelect and defaults allowCustom to true', () => {
    const result = parseOpenCodeQuestion({
      questions: [{
        question: 'Pick?',
        multiple: true,
        options: [{ label: 'A' }, { label: 'B' }],
      }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
    expect(result!.questions[0]!.allowCustom).toBe(true);
  });

  it('respects explicit custom: false', () => {
    const result = parseOpenCodeQuestion({
      questions: [{
        question: 'Pick?',
        custom: false,
        options: [{ label: 'A' }],
      }],
    });
    expect(result!.questions[0]!.allowCustom).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// multiSelect spelling / typing drift — hook helpers and third-party agents
// have been observed to ship snake_case, lowercase, string-encoded or 1/0
// flags instead of the SDK's documented `multiSelect: true`. `readMultiSelect`
// accepts the full drift matrix so one renderer works end-to-end.
// ---------------------------------------------------------------------------

describe('multiSelect drift tolerance', () => {
  const baseOptions = [{ label: 'A' }, { label: 'B' }];

  it('Claude accepts multi_select fallback', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multi_select: true }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
  });

  it('Claude accepts lowercase multiselect fallback', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multiselect: 'TRUE' }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
  });

  it('Claude treats "no" as false', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multiSelect: 'no' }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(false);
  });

  it('Claude defaults to false when flag absent', () => {
    const result = parseClaudeAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(false);
  });

  it('Kimi accepts camelCase fallback', () => {
    const result = parseKimiAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multiSelect: true }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
  });

  it('Kimi accepts numeric 1', () => {
    const result = parseKimiAskUserQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multi_select: 1 }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
  });

  it('OpenCode accepts multiSelect fallback when "multiple" is absent', () => {
    const result = parseOpenCodeQuestion({
      questions: [{ question: 'Q?', options: baseOptions, multiSelect: true }],
    });
    expect(result!.questions[0]!.multiSelect).toBe(true);
  });

  it('Codex stays single-select regardless of drift', () => {
    const result = parseCodexRequestUserInput({
      questions: [{
        id: 'q1',
        question: 'Q?',
        options: [{ label: 'A' }],
        // Codex intentionally ignores any multi-select flag — it is always single-pick.
        multiSelect: true,
        multi_select: true,
      }],
    });
    expect(result!.questions[0]!.multiSelect).toBeUndefined();
  });
});
