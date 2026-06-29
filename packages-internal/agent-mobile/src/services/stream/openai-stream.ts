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
import { parseSSEStream } from './sse-parser';

export interface IStreamDelta {
  readonly textDelta?: string;
  readonly thinkingDelta?: string;
  readonly usage?: IChatUsage;
  readonly done: boolean;
}

interface IOpenAIChoice {
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
  };
  finish_reason?: string | null;
}

interface IOpenAIChunk {
  choices?: IOpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function* streamOpenAICompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  headers?: Record<string, string>,
  signal?: AbortSignal
): AsyncGenerator<IStreamDelta> {
  const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ model, messages, stream: true, stream_options: { include_usage: true } }),
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

  for await (const event of parseSSEStream(resp.body, signal)) {
    if (event.data === '[DONE]') {
      yield { done: true };
      return;
    }

    let chunk: IOpenAIChunk;
    try {
      chunk = JSON.parse(event.data) as IOpenAIChunk;
    } catch {
      continue;
    }

    const choice = chunk.choices?.[0];
    const delta = choice?.delta;

    const textDelta = delta?.content ?? undefined;
    const thinkingDelta = delta?.reasoning_content ?? undefined;

    let usage: IChatUsage | undefined;
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens ?? 0,
        completionTokens: chunk.usage.completion_tokens ?? 0,
        totalTokens: chunk.usage.total_tokens ?? 0,
      };
    }

    if (textDelta || thinkingDelta || usage) {
      yield { textDelta, thinkingDelta, usage, done: false };
    }

    if (choice?.finish_reason != null) {
      yield { usage, done: true };
      return;
    }
  }

  yield { done: true };
}

export function buildOpenAIMessages(
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
      blocks.push({ type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } });
    }
  }
  return blocks;
}
