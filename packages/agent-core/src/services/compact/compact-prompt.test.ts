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

import type { IChatMessage, IMessagePart } from '@termlnk/agent';
import { describe, expect, it } from 'vitest';
import { buildCompactUserPrompt, buildSummaryUserMessage, formatMessagesForCompaction, getCompactPrompt } from './compact-prompt';

function msg(role: IChatMessage['role'], parts: IMessagePart[], extras?: Partial<IChatMessage>): IChatMessage {
  return { id: 'id', role, parts, createdAt: 0, ...extras };
}

function textMsg(role: IChatMessage['role'], text: string, extras?: Partial<IChatMessage>): IChatMessage {
  return msg(role, [{ type: 'text', text }], extras);
}

describe('getCompactPrompt', () => {
  it('includes the 9 required sections', () => {
    const prompt = getCompactPrompt();
    expect(prompt).toContain('Primary Request and Intent');
    expect(prompt).toContain('Key Technical Concepts');
    expect(prompt).toContain('Files and Code Sections');
    expect(prompt).toContain('Errors and Fixes');
    expect(prompt).toContain('Problem Solving');
    expect(prompt).toContain('All User Messages');
    expect(prompt).toContain('Pending Tasks');
    expect(prompt).toContain('Current Work');
    expect(prompt).toContain('Optional Next Step');
  });

  it('appends user-supplied instructions when provided', () => {
    const prompt = getCompactPrompt('Focus on filenames');
    expect(prompt).toContain('Additional Instructions');
    expect(prompt).toContain('Focus on filenames');
  });

  it('ignores blank custom instructions', () => {
    const prompt = getCompactPrompt('   ');
    expect(prompt).not.toContain('Additional Instructions');
  });
});

describe('formatMessagesForCompaction', () => {
  it('skips compact_boundary messages', () => {
    const output = formatMessagesForCompaction([
      textMsg('user', 'hi'),
      textMsg('compact_boundary', 'boundary'),
      textMsg('assistant', 'hey'),
    ]);
    expect(output).toContain('USER');
    expect(output).toContain('ASSISTANT');
    expect(output).not.toContain('boundary');
  });

  it('embeds thinking blocks and tool call metadata', () => {
    const output = formatMessagesForCompaction([
      msg('assistant', [
        { type: 'text', text: 'body' },
        { type: 'thinking', thinking: 'internal' },
        {
          type: 'tool',
          toolCallId: 't1',
          toolName: 'foo',
          state: 'output-available',
          input: { a: 1 },
        },
      ]),
    ]);
    expect(output).toContain('<thinking>');
    expect(output).toContain('tool_call foo');
    expect(output).toContain('args={"a":1}');
  });
});

describe('buildCompactUserPrompt', () => {
  it('wraps the transcript in <conversation>', () => {
    const prompt = buildCompactUserPrompt([textMsg('user', 'hello')]);
    expect(prompt).toContain('<conversation>');
    expect(prompt).toContain('</conversation>');
    expect(prompt).toContain('hello');
  });
});

describe('buildSummaryUserMessage', () => {
  it('wraps the summary in <previous-conversation-summary>', () => {
    const out = buildSummaryUserMessage('summary text');
    expect(out).toContain('<previous-conversation-summary>');
    expect(out).toContain('summary text');
    expect(out).toContain('</previous-conversation-summary>');
  });

  it('surfaces user instructions when provided', () => {
    const out = buildSummaryUserMessage('x', 'Keep code snippets');
    expect(out).toContain('original compaction instructions were: Keep code snippets');
  });
});
