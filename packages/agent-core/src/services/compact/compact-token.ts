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

const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 3.8;

export function estimateTokensFromText(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / TOKEN_ESTIMATE_CHARS_PER_TOKEN);
}

export function estimateTokensFromMessage(message: IChatMessage): number {
  let tokens = estimateTokensFromText(message.content ?? '');
  if (message.thinking) {
    tokens += estimateTokensFromText(message.thinking);
  }
  if (message.toolCalls) {
    for (const call of message.toolCalls) {
      try {
        tokens += estimateTokensFromText(JSON.stringify(call.args ?? {}));
      } catch {
        // ignore unserializable args
      }
      if (call.error) {
        tokens += estimateTokensFromText(call.error);
      }
    }
  }
  return tokens;
}

export function getLatestPromptTokens(messages: IChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const usage = messages[i]?.usage;
    if (usage && typeof usage.promptTokens === 'number' && usage.promptTokens > 0) {
      return usage.promptTokens;
    }
  }
  return messages.reduce((sum, m) => sum + estimateTokensFromMessage(m), 0);
}

export function shouldAutoCompact(
  tokens: number,
  contextWindow: number,
  config: ICompactConfig
): boolean {
  if (!config.enabled) {
    return false;
  }
  if (contextWindow <= 0) {
    return false;
  }
  const threshold = (config.thresholdPercent / 100) * contextWindow;
  return tokens >= threshold;
}
