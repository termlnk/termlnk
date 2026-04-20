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

import type { IChatMessage, ICompactConfig } from '@termlnk/agent';
import { describe, expect, it } from 'vitest';
import { estimateTokensFromMessage, estimateTokensFromText, getLatestPromptTokens, shouldAutoCompact } from './compact-token';

function msg(overrides: Partial<IChatMessage>): IChatMessage {
  return {
    id: 'id',
    role: 'user',
    content: '',
    createdAt: 0,
    ...overrides,
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
  it('sums content + thinking + tool call args', () => {
    const tokens = estimateTokensFromMessage(msg({
      content: 'hello',
      thinking: 'deep',
      toolCalls: [{ id: 't1', name: 'foo', args: { a: 1 }, status: 'success' }],
    }));
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('getLatestPromptTokens', () => {
  it('returns the latest non-zero promptTokens from usage', () => {
    const messages: IChatMessage[] = [
      msg({ role: 'assistant', usage: { promptTokens: 100, completionTokens: 0, totalTokens: 100 } }),
      msg({ role: 'user', content: 'ignored' }),
      msg({ role: 'assistant', usage: { promptTokens: 500, completionTokens: 0, totalTokens: 500 } }),
      msg({ role: 'user', content: 'tail' }),
    ];
    expect(getLatestPromptTokens(messages)).toBe(500);
  });

  it('falls back to text-based estimation when no usage present', () => {
    const messages: IChatMessage[] = [msg({ content: 'a'.repeat(38) })];
    expect(getLatestPromptTokens(messages)).toBe(10);
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
