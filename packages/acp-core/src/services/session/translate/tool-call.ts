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

import type { ToolCall, ToolCallContent, ToolCallUpdate } from '@agentclientprotocol/sdk';
import type { IToolDiff, IToolOutput, IToolPart, ToolPartState } from '@termlnk/agent';

export function mapToolStatus(status: string | null | undefined): ToolPartState {
  switch (status) {
    case 'pending':
      return 'input-available';
    case 'in_progress':
      return 'input-available';
    case 'completed':
      return 'output-available';
    case 'failed':
      return 'output-error';
    default:
      return 'input-available';
  }
}

export function translateToolCall(call: ToolCall): IToolPart {
  const state = mapToolStatus(call.status);
  const output = contentToOutput(call.content, call.rawOutput, state);
  return {
    type: 'tool',
    toolCallId: call.toolCallId,
    toolName: call.name || call.title || call.kind || 'tool',
    state,
    input: normalizeInput(call.rawInput),
    inputRaw: typeof call.rawInput === 'string' ? call.rawInput : undefined,
    output,
  };
}

export function translateToolCallUpdate(update: ToolCallUpdate): IToolPart {
  const state = mapToolStatus(update.status);
  const output = contentToOutput(update.content ?? undefined, update.rawOutput, state);
  return {
    type: 'tool',
    toolCallId: update.toolCallId,
    toolName: update.name || update.title || update.kind || 'tool',
    state,
    input: normalizeInput(update.rawInput),
    inputRaw: typeof update.rawInput === 'string' ? update.rawInput : undefined,
    output,
  };
}

function normalizeInput(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return { value: raw };
}

function contentToOutput(
  content: ToolCallContent[] | null | undefined,
  rawOutput: unknown,
  state: ToolPartState
): IToolOutput | undefined {
  const diffs: IToolDiff[] = [];
  const texts: string[] = [];
  let terminalId: string | undefined;

  if (content) {
    for (const item of content) {
      if (item.type === 'diff') {
        diffs.push({
          path: item.path,
          oldText: item.oldText ?? null,
          newText: item.newText,
        });
      } else if (item.type === 'terminal') {
        terminalId = item.terminalId;
      } else if (item.type === 'content') {
        const block = item.content;
        if (block && typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
          texts.push(String((block as { text: string }).text));
        }
      }
    }
  }

  if (typeof rawOutput === 'string' && rawOutput.length > 0) {
    texts.push(rawOutput);
  } else if (rawOutput != null && typeof rawOutput === 'object') {
    try {
      texts.push(JSON.stringify(rawOutput, null, 2));
    } catch {
      // ignore
    }
  }

  const hasAnything = texts.length > 0 || diffs.length > 0 || terminalId;
  if (!hasAnything) {
    return state === 'output-error' ? { isError: true } : undefined;
  }

  return {
    text: texts.length > 0 ? texts.join('\n') : undefined,
    isError: state === 'output-error',
    diff: diffs.length > 0 ? diffs : undefined,
    terminalId,
  };
}
