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

import type { IChatMessage, ICompactConfig, IMessagePart } from '@termlnk/agent';
import { describe, expect, it } from 'vitest';
import { estimateTokensFromMessage, estimateTokensFromText, getLatestContextTokens, shouldAutoCompact } from './compact-token';

function msg(overrides: Partial<IChatMessage> & { parts?: IMessagePart[] } = {}): IChatMessage {
  const { parts, ...rest } = overrides;
  return {
    id: 'id',
    role: 'user',
    parts: parts ?? [],
    createdAt: 0,
    ...rest,
  };
}

describe('estimateTokensFromText', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('estimates roughly chars/3.8', () => {
    expect(estimateTokensFromText('a'.repeat(38))).toBe(10);
  });
});

describe('estimateTokensFromMessage', () => {
  it('sums text + thinking + tool input + output text', () => {
    const tokens = estimateTokensFromMessage(msg({
      parts: [
        { type: 'text', text: 'hello' },
        { type: 'thinking', thinking: 'deep' },
        {
          type: 'tool',
          toolCallId: 't1',
          toolName: 'foo',
          state: 'output-available',
          input: { a: 1 },
          output: { text: 'result' },
        },
      ],
    }));
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('getLatestContextTokens', () => {
  it('returns the latest non-zero totalTokens from usage', () => {
    const messages: IChatMessage[] = [
      msg({ role: 'assistant', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } }),
      msg({ role: 'user', parts: [{ type: 'text', text: 'ignored' }] }),
      msg({ role: 'assistant', usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 } }),
      msg({ role: 'user', parts: [{ type: 'text', text: 'tail' }] }),
    ];
    expect(getLatestContextTokens(messages)).toBe(700);
  });

  it('falls back to text-based estimation when no usage present', () => {
    const messages: IChatMessage[] = [msg({ parts: [{ type: 'text', text: 'a'.repeat(38) }] })];
    expect(getLatestContextTokens(messages)).toBe(10);
  });
});

describe('shouldAutoCompact', () => {
  const config: ICompactConfig = { enabled: true, thresholdPercent: 80, keepRecentMessages: 4 };

  it('returns false when disabled', () => {
    expect(shouldAutoCompact(10000, 10000, { ...config, enabled: false })).toBe(false);
  });

  it('returns false when contextWindow is zero', () => {
    expect(shouldAutoCompact(100, 0, config)).toBe(false);
  });

  it('returns true at or above the threshold', () => {
    // 80% of 10000 = 8000
    expect(shouldAutoCompact(8000, 10000, config)).toBe(true);
    expect(shouldAutoCompact(9000, 10000, config)).toBe(true);
  });

  it('returns false just below the threshold', () => {
    expect(shouldAutoCompact(7999, 10000, config)).toBe(false);
  });
});
