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

import type { IMessagePart, ITextPart, IThinkingPart, IToolOutput, IToolPart, ToolPartState } from '@termlnk/agent';
import { Allow, parse as parsePartialJson } from 'partial-json';

export function getTextFromParts(parts: IMessagePart[]): string {
  return parts
    .filter((p): p is ITextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function getThinkingFromParts(parts: IMessagePart[]): string {
  return parts
    .filter((p): p is IThinkingPart => p.type === 'thinking')
    .map((p) => p.thinking)
    .join('');
}

export function getToolPartsFromParts(parts: IMessagePart[]): IToolPart[] {
  return parts.filter((p): p is IToolPart => p.type === 'tool');
}

export function getErrorFromParts(parts: IMessagePart[]): string | undefined {
  for (const p of parts) {
    if (p.type === 'error') {
      return p.message;
    }
  }
  return undefined;
}

export function appendTextDelta(parts: IMessagePart[], delta: string): IMessagePart[] {
  if (!delta) {
    return parts;
  }
  const last = parts.at(-1);
  if (last?.type === 'text') {
    return [...parts.slice(0, -1), { type: 'text', text: last.text + delta }];
  }
  return [...parts, { type: 'text', text: delta }];
}

export function appendThinkingDelta(
  parts: IMessagePart[],
  delta: string,
  signature?: string
): IMessagePart[] {
  if (!delta) {
    return parts;
  }
  const last = parts.at(-1);
  if (last?.type === 'thinking') {
    return [
      ...parts.slice(0, -1),
      {
        type: 'thinking',
        thinking: last.thinking + delta,
        signature: signature ?? last.signature,
      },
    ];
  }
  return [...parts, { type: 'thinking', thinking: delta, signature }];
}

export function upsertToolPartInputDelta(
  parts: IMessagePart[],
  toolCallId: string,
  toolName: string,
  delta: string
): IMessagePart[] {
  const existingIndex = parts.findIndex(
    (p) => p.type === 'tool' && p.toolCallId === toolCallId
  );

  if (existingIndex < 0) {
    const inputRaw = delta;
    return [
      ...parts,
      {
        type: 'tool',
        toolCallId,
        toolName,
        state: 'input-streaming',
        inputRaw,
        input: tryParsePartialInput(inputRaw),
      },
    ];
  }

  const existing = parts[existingIndex] as IToolPart;
  const inputRaw = (existing.inputRaw ?? '') + delta;
  const next: IToolPart = {
    ...existing,
    inputRaw,
    input: tryParsePartialInput(inputRaw),
  };
  return [
    ...parts.slice(0, existingIndex),
    next,
    ...parts.slice(existingIndex + 1),
  ];
}

export interface IToolPartFinalizeOptions {
  state: ToolPartState;
  finalInput?: Record<string, unknown>;
  output?: IToolOutput;
}

export function finalizeToolPart(
  parts: IMessagePart[],
  toolCallId: string,
  options: IToolPartFinalizeOptions
): IMessagePart[] {
  const idx = parts.findIndex(
    (p) => p.type === 'tool' && p.toolCallId === toolCallId
  );
  if (idx < 0) {
    return parts;
  }
  const existing = parts[idx] as IToolPart;
  const next: IToolPart = {
    ...existing,
    state: options.state,
    input: options.finalInput ?? existing.input,
    inputRaw: options.finalInput ? undefined : existing.inputRaw,
    output: options.output ?? existing.output,
  };
  return [...parts.slice(0, idx), next, ...parts.slice(idx + 1)];
}

export function ensureToolPart(
  parts: IMessagePart[],
  toolCallId: string,
  toolName: string,
  input?: Record<string, unknown>
): IMessagePart[] {
  const idx = parts.findIndex(
    (p) => p.type === 'tool' && p.toolCallId === toolCallId
  );
  if (idx >= 0) {
    return parts;
  }
  return [
    ...parts,
    {
      type: 'tool',
      toolCallId,
      toolName,
      state: 'input-available',
      input,
    },
  ];
}

export function appendErrorPart(parts: IMessagePart[], message: string): IMessagePart[] {
  return [...parts, { type: 'error', message }];
}

function tryParsePartialInput(raw: string): Record<string, unknown> | undefined {
  if (!raw || raw.trim() === '') {
    return undefined;
  }
  try {
    const parsed = parsePartialJson(raw, Allow.ALL);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
