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

import type { ACPSessionStatus, IACPPermissionRequest, IACPSessionService, IACPStreamEvent } from '@termlnk/acp';
import type { AgentStatus, IChatMessage, IMessagePart, IPlanPart, IToolPart } from '@termlnk/agent';
import type { IConversationSource } from '@termlnk/agent-ui';
import type { Observable, Subscription } from 'rxjs';
import { generateRandomId } from '@termlnk/core';
import { BehaviorSubject, of } from 'rxjs';

/** ACP has no queued-send or compaction pipeline; the surface stays constant. */
const NO_PENDING_IDS$: Observable<string[]> = of([]);
const NEVER_COMPACTING$: Observable<boolean> = of(false);

export interface IACPConversationSource extends IConversationSource {
  /** Session-level streaming flag, used by the ACP session header. */
  readonly isStreaming$: Observable<boolean>;
  readonly permissionRequest$: Observable<IACPPermissionRequest | null>;
  respondPermission(requestId: string, optionId: string): Promise<void>;
  dispose(): void;
}

/**
 * Reduces IACPStreamEvent into the IConversationSource surface that ChatMessages
 * already understands. One instance per ACP tab.
 */
export function createACPConversationSource(
  sessionId: string,
  sessionService: IACPSessionService
): IACPConversationSource {
  const messages$ = new BehaviorSubject<IChatMessage[]>([]);
  const currentMessage$ = new BehaviorSubject<IChatMessage | null>(null);
  const isStreaming$ = new BehaviorSubject(false);
  const status$ = new BehaviorSubject<AgentStatus>('idle');
  const permissionRequest$ = new BehaviorSubject<IACPPermissionRequest | null>(null);

  let messages: IChatMessage[] = [];
  let current: IChatMessage | null = null;

  const publish = (): void => {
    messages$.next(messages);
    currentMessage$.next(current);
  };

  const sub: Subscription = sessionService.events$(sessionId).subscribe((event) => {
    applyEvent(event);
  });

  function applyEvent(event: IACPStreamEvent): void {
    switch (event.type) {
      case 'session_status': {
        status$.next(mapSessionStatus(event.status));
        isStreaming$.next(event.status === 'streaming');
        if (event.status !== 'streaming' && current) {
          messages = [...messages, { ...current, isStreaming: false }];
          current = null;
          publish();
        }
        break;
      }
      case 'message_upsert': {
        if (event.message.role === 'assistant' && event.message.isStreaming) {
          current = event.message;
        } else {
          const idx = messages.findIndex((m) => m.id === event.message.id);
          if (idx === -1) {
            messages = [...messages, event.message];
          } else {
            const copy = messages.slice();
            copy[idx] = event.message;
            messages = copy;
          }
          if (current?.id === event.message.id) {
            current = null;
          }
        }
        publish();
        break;
      }
      case 'part_append': {
        updateParts(event.messageId, (parts) =>
          appendPart(parts, event.part, event.merge === true));
        break;
      }
      case 'tool_update': {
        updateParts(event.messageId, (parts) => upsertToolPart(parts, event.part));
        break;
      }
      case 'plan': {
        updateParts(event.messageId, (parts) => upsertPlanPart(parts, event.entries));
        break;
      }
      case 'permission_requested': {
        permissionRequest$.next(event.request);
        break;
      }
      case 'permission_resolved': {
        if (permissionRequest$.getValue()?.requestId === event.requestId) {
          permissionRequest$.next(null);
        }
        break;
      }
      case 'turn_complete': {
        isStreaming$.next(false);
        status$.next('idle');
        if (current) {
          messages = [...messages, { ...current, isStreaming: false }];
          current = null;
          publish();
        }
        break;
      }
      case 'history_replay_end': {
        messages = event.messages.map((m) => ({ ...m, isStreaming: false }));
        current = null;
        publish();
        break;
      }
      case 'error': {
        status$.next('error');
        isStreaming$.next(false);
        const errMsg: IChatMessage = {
          id: `acp_err_${generateRandomId()}`,
          role: 'assistant',
          parts: [{ type: 'error', message: event.message }],
          createdAt: Date.now(),
        };
        messages = [...messages, errMsg];
        current = null;
        publish();
        break;
      }
      default:
        break;
    }
  }

  /**
   * Rewrite one message's parts without mutating the existing object: React
   * memoisation compares identities, and ACP replays land on messages that are
   * already rendered.
   */
  function updateParts(
    messageId: string,
    reduce: (parts: IMessagePart[]) => IMessagePart[]
  ): void {
    if (current?.id === messageId) {
      current = { ...current, parts: reduce(current.parts) };
      publish();
      return;
    }
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      return;
    }
    const next = messages.slice();
    next[idx] = { ...messages[idx], parts: reduce(messages[idx].parts) };
    messages = next;
    publish();
  }

  return {
    messages$: messages$.asObservable(),
    currentMessage$: currentMessage$.asObservable(),
    isStreaming$: isStreaming$.asObservable(),
    status$: status$.asObservable(),
    pendingMessageIds$: NO_PENDING_IDS$,
    isCompacting$: NEVER_COMPACTING$,
    permissionRequest$: permissionRequest$.asObservable(),
    // ACP sends prompts synchronously — there is no client-side queue to cancel
    // an individual message from. Cancelling the turn is stopStreaming().
    cancelPending: async () => {},
    stopStreaming: () => sessionService.cancel(sessionId),
    respondPermission: (requestId, optionId) =>
      sessionService.respondPermission(sessionId, requestId, optionId),
    dispose: () => {
      sub.unsubscribe();
      messages$.complete();
      currentMessage$.complete();
      isStreaming$.complete();
      status$.complete();
      permissionRequest$.complete();
    },
  };
}

function mapSessionStatus(status: ACPSessionStatus): AgentStatus {
  switch (status) {
    case 'connecting':
      return 'thinking';
    case 'streaming':
      return 'streaming';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

function appendPart(parts: IMessagePart[], part: IMessagePart, merge: boolean): IMessagePart[] {
  const next = parts.slice();
  if (merge && next.length > 0) {
    const last = next[next.length - 1];
    if (part.type === 'text' && last.type === 'text') {
      next[next.length - 1] = { type: 'text', text: last.text + part.text };
      return next;
    }
    if (part.type === 'thinking' && last.type === 'thinking') {
      next[next.length - 1] = {
        type: 'thinking',
        thinking: last.thinking + part.thinking,
      };
      return next;
    }
  }
  next.push(part);
  return next;
}

function upsertPlanPart(parts: IMessagePart[], entries: IPlanPart['entries']): IMessagePart[] {
  const planPart: IPlanPart = { type: 'plan', entries };
  const idx = parts.findIndex((p) => p.type === 'plan');
  const next = parts.slice();
  if (idx === -1) {
    next.push(planPart);
  } else {
    next[idx] = planPart;
  }
  return next;
}

function upsertToolPart(parts: IMessagePart[], part: IToolPart): IMessagePart[] {
  const next = parts.slice();
  const idx = next.findIndex(
    (p): p is IToolPart => p.type === 'tool' && p.toolCallId === part.toolCallId
  );
  if (idx === -1) {
    next.push(part);
  } else {
    const prev = next[idx] as IToolPart;
    next[idx] = {
      ...prev,
      ...part,
      toolName: part.toolName && part.toolName !== 'tool' ? part.toolName : prev.toolName,
      input: part.input ?? prev.input,
      inputRaw: part.inputRaw ?? prev.inputRaw,
      output: part.output
        ? {
          ...prev.output,
          ...part.output,
          diff: part.output.diff ?? prev.output?.diff,
          terminalId: part.output.terminalId ?? prev.output?.terminalId,
        }
        : prev.output,
    };
  }
  return next;
}
