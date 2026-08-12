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

import type { SessionUpdate } from '@agentclientprotocol/sdk';
import type { IACPStreamEvent } from '@termlnk/acp';
import type { IChatMessage, IMessagePart, IPlanEntry, IToolPart } from '@termlnk/agent';
import { translateToolCall, translateToolCallUpdate } from './tool-call';

export interface ISessionUpdateTranslatorState {
  /** Current assistant message being streamed into. */
  assistantMessageId: string | null;
  /** Current user message being streamed (history replay). */
  userMessageId: string | null;
  /** toolCallId → owning message id */
  toolMessageIds: Map<string, string>;
}

export function createTranslatorState(): ISessionUpdateTranslatorState {
  return {
    assistantMessageId: null,
    userMessageId: null,
    toolMessageIds: new Map(),
  };
}

export interface ITranslateResult {
  events: IACPStreamEvent[];
  /** Side-effect free snapshot of messages produced during history replay accumulation. */
}

/**
 * Translate one ACP SessionUpdate into zero or more IACPStreamEvent values.
 * Pure with respect to I/O; mutates `state` for streaming continuity.
 */
export function translateSessionUpdate(
  update: SessionUpdate,
  state: ISessionUpdateTranslatorState,
  options: { now?: number; newId?: () => string } = {}
): IACPStreamEvent[] {
  const now = options.now ?? Date.now();
  const newId = options.newId ?? (() => cryptoRandomId());
  const events: IACPStreamEvent[] = [];

  switch (update.sessionUpdate) {
    case 'agent_message_chunk': {
      const text = contentBlockToText(update.content);
      if (text === null) {
        break;
      }
      const messageId = ensureAssistantMessage(state, events, now, newId);
      events.push({
        type: 'part_append',
        messageId,
        part: { type: 'text', text },
        merge: true,
      });
      break;
    }
    case 'agent_thought_chunk': {
      const text = contentBlockToText(update.content);
      if (text === null) {
        break;
      }
      const messageId = ensureAssistantMessage(state, events, now, newId);
      events.push({
        type: 'part_append',
        messageId,
        part: { type: 'thinking', thinking: text },
        merge: true,
      });
      break;
    }
    case 'user_message_chunk': {
      const text = contentBlockToText(update.content);
      if (text === null) {
        break;
      }
      const messageId = ensureUserMessage(state, events, now, newId);
      events.push({
        type: 'part_append',
        messageId,
        part: { type: 'text', text },
        merge: true,
      });
      break;
    }
    case 'tool_call': {
      const messageId = ensureAssistantMessage(state, events, now, newId);
      state.toolMessageIds.set(update.toolCallId, messageId);
      const part = translateToolCall(update);
      events.push({ type: 'tool_update', messageId, part });
      break;
    }
    case 'tool_call_update': {
      const messageId =
        state.toolMessageIds.get(update.toolCallId)
        ?? ensureAssistantMessage(state, events, now, newId);
      state.toolMessageIds.set(update.toolCallId, messageId);
      const part = translateToolCallUpdate(update);
      events.push({ type: 'tool_update', messageId, part });
      break;
    }
    case 'plan': {
      const messageId = ensureAssistantMessage(state, events, now, newId);
      events.push({
        type: 'plan',
        messageId,
        entries: (update.entries ?? []).map(mapPlanEntry),
      });
      break;
    }
    case 'current_mode_update': {
      events.push({
        type: 'mode_update',
        currentModeId: update.currentModeId,
      });
      break;
    }
    case 'available_commands_update': {
      events.push({
        type: 'commands_update',
        commands: (update.availableCommands ?? []).map((c) => ({
          name: c.name,
          description: c.description || undefined,
          inputHint: c.input?.hint ?? undefined,
        })),
      });
      break;
    }
    case 'session_info_update': {
      if (typeof update.title === 'string' && update.title.length > 0) {
        events.push({ type: 'title_update', title: update.title });
      }
      break;
    }
    case 'config_option_update': {
      // Model/mode options often arrive here; surface title-level changes only for now.
      break;
    }
    case 'usage_update':
    case 'plan_update':
    case 'plan_removed':
    default:
      break;
  }

  return events;
}

function mapPlanEntry(entry: { content: string; priority: IPlanEntry['priority']; status: IPlanEntry['status'] }): IPlanEntry {
  return {
    content: entry.content,
    priority: entry.priority,
    status: entry.status,
  };
}

function contentBlockToText(content: { type: string; text?: string } | undefined): string | null {
  if (!content) {
    return null;
  }
  if (content.type === 'text' && typeof content.text === 'string') {
    return content.text;
  }
  // Non-text blocks (image/resource) are ignored for streaming text; images can be
  // added later as IImagePart when we have a dedicated pipeline.
  return null;
}

function ensureAssistantMessage(
  state: ISessionUpdateTranslatorState,
  events: IACPStreamEvent[],
  now: number,
  newId: () => string
): string {
  if (state.assistantMessageId) {
    return state.assistantMessageId;
  }
  // Starting a new assistant turn closes any open user stream.
  state.userMessageId = null;
  const id = newId();
  state.assistantMessageId = id;
  const message: IChatMessage = {
    id,
    role: 'assistant',
    parts: [],
    isStreaming: true,
    createdAt: now,
  };
  events.push({ type: 'message_upsert', message });
  return id;
}

function ensureUserMessage(
  state: ISessionUpdateTranslatorState,
  events: IACPStreamEvent[],
  now: number,
  newId: () => string
): string {
  if (state.userMessageId) {
    return state.userMessageId;
  }
  // Starting a user message (history replay) closes any open assistant stream.
  state.assistantMessageId = null;
  const id = newId();
  state.userMessageId = id;
  const message: IChatMessage = {
    id,
    role: 'user',
    parts: [],
    createdAt: now,
  };
  events.push({ type: 'message_upsert', message });
  return id;
}

function cryptoRandomId(): string {
  // Prefer Web Crypto when available (Node 22 / browsers).
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `acp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Reduce a batch of stream events into a message list (used by history replay + tests). */
export function reduceStreamEvents(
  messages: IChatMessage[],
  events: IACPStreamEvent[]
): IChatMessage[] {
  let next = messages.slice();
  for (const event of events) {
    next = applyEvent(next, event);
  }
  return next;
}

function applyEvent(messages: IChatMessage[], event: IACPStreamEvent): IChatMessage[] {
  switch (event.type) {
    case 'message_upsert': {
      const idx = messages.findIndex((m) => m.id === event.message.id);
      if (idx === -1) {
        return [...messages, event.message];
      }
      const copy = messages.slice();
      copy[idx] = event.message;
      return copy;
    }
    case 'part_append': {
      return updateMessage(messages, event.messageId, (msg) => {
        const parts = msg.parts.slice();
        if (event.merge && parts.length > 0) {
          const last = parts[parts.length - 1];
          if (event.part.type === 'text' && last.type === 'text') {
            parts[parts.length - 1] = { type: 'text', text: last.text + event.part.text };
            return { ...msg, parts };
          }
          if (event.part.type === 'thinking' && last.type === 'thinking') {
            parts[parts.length - 1] = {
              type: 'thinking',
              thinking: last.thinking + event.part.thinking,
            };
            return { ...msg, parts };
          }
        }
        parts.push(event.part);
        return { ...msg, parts };
      });
    }
    case 'tool_update': {
      return updateMessage(messages, event.messageId, (msg) => {
        const parts = msg.parts.slice();
        const idx = parts.findIndex(
          (p): p is IToolPart => p.type === 'tool' && p.toolCallId === event.part.toolCallId
        );
        if (idx === -1) {
          parts.push(event.part);
        } else {
          parts[idx] = mergeToolPart(parts[idx] as IToolPart, event.part);
        }
        return { ...msg, parts };
      });
    }
    case 'plan': {
      return updateMessage(messages, event.messageId, (msg) => {
        const parts = msg.parts.slice();
        const idx = parts.findIndex((p) => p.type === 'plan');
        const planPart: IMessagePart = { type: 'plan', entries: event.entries };
        if (idx === -1) {
          parts.push(planPart);
        } else {
          parts[idx] = planPart;
        }
        return { ...msg, parts };
      });
    }
    case 'turn_complete': {
      return messages.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
    }
    default:
      return messages;
  }
}

function updateMessage(
  messages: IChatMessage[],
  messageId: string,
  updater: (msg: IChatMessage) => IChatMessage
): IChatMessage[] {
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) {
    return messages;
  }
  const copy = messages.slice();
  copy[idx] = updater(copy[idx]);
  return copy;
}

function mergeToolPart(prev: IToolPart, next: IToolPart): IToolPart {
  return {
    ...prev,
    ...next,
    // Updates often omit name/title; keep the original label instead of "tool".
    toolName: next.toolName && next.toolName !== 'tool' ? next.toolName : prev.toolName,
    input: next.input ?? prev.input,
    inputRaw: next.inputRaw ?? prev.inputRaw,
    output: next.output
      ? {
        ...prev.output,
        ...next.output,
        diff: next.output.diff ?? prev.output?.diff,
        terminalId: next.output.terminalId ?? prev.output?.terminalId,
      }
      : prev.output,
  };
}
