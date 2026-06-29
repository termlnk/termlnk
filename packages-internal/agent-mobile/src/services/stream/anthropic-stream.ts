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

import type { IChatUsage, IMobileMessagePart } from '../../models/message';
import type { IStreamDelta } from './openai-stream';
import { parseSSEStream } from './sse-parser';

const ANTHROPIC_VERSION = '2023-06-01';

export function buildAnthropicMessages(
  parts: readonly IMobileMessagePart[]
): string | Array<Record<string, unknown>> {
  const hasImage = parts.some((p) => p.type === 'image');
  if (!hasImage) {
    return parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }

  const blocks: Array<Record<string, unknown>> = [];
  for (const part of parts) {
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'image') {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } });
    }
  }
  return blocks;
}

interface IAnthropicContentDelta {
  type: 'text_delta' | 'thinking_delta' | 'signature_delta';
  text?: string;
  thinking?: string;
}

interface IAnthropicMessageDelta {
  usage?: { output_tokens?: number };
}

interface IAnthropicEvent {
  type: string;
  content_block?: { type: string };
  delta?: IAnthropicContentDelta | IAnthropicMessageDelta;
  message?: {
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

export interface IAnthropicStreamOptions {
  readonly reasoning?: boolean;
  readonly maxTokens?: number;
  readonly thinkingBudget?: number;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export async function* streamAnthropicMessages(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  options: IAnthropicStreamOptions = {}
): AsyncGenerator<IStreamDelta> {
  const { reasoning, maxTokens = 8192, thinkingBudget, headers, signal } = options;

  const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens, stream: true };
  if (reasoning) {
    const budget = thinkingBudget ?? Math.max(1024, maxTokens - 1024);
    body.thinking = { type: 'enabled', budget_tokens: budget };
  }

  const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text();
    let message = `HTTP ${resp.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch {
      if (text.length > 0 && text.length < 500) {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (!resp.body) {
    throw new Error('Response body is not a readable stream');
  }

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of parseSSEStream(resp.body, signal)) {
    let parsed: IAnthropicEvent;
    try {
      parsed = JSON.parse(event.data) as IAnthropicEvent;
    } catch {
      continue;
    }

    switch (parsed.type) {
      case 'message_start': {
        const usage = parsed.message?.usage;
        if (usage) {
          inputTokens = usage.input_tokens ?? 0;
          outputTokens = usage.output_tokens ?? 0;
        }
        break;
      }

      case 'content_block_delta': {
        const delta = parsed.delta as IAnthropicContentDelta | undefined;
        if (!delta) {
          break;
        }

        if (delta.type === 'text_delta' && delta.text) {
          yield { textDelta: delta.text, done: false };
        } else if (delta.type === 'thinking_delta' && delta.thinking) {
          yield { thinkingDelta: delta.thinking, done: false };
        }
        break;
      }

      case 'message_delta': {
        const delta = parsed.delta as IAnthropicMessageDelta | undefined;
        if (delta?.usage?.output_tokens) {
          outputTokens = delta.usage.output_tokens;
        }
        break;
      }

      case 'message_stop': {
        const usage: IChatUsage = {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        };
        yield { usage, done: true };
        return;
      }

      case 'error': {
        const errorData = parsed as unknown as { error?: { message?: string } };
        throw new Error(errorData.error?.message ?? 'Anthropic stream error');
      }
    }
  }

  yield { done: true };
}
