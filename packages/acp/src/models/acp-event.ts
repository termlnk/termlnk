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

import type { IChatMessage, IMessagePart, IPlanEntry } from '@termlnk/agent';
import type {
  ACPSessionStatus,
  IACPAvailableCommand,
  IACPSessionMode,
  IACPSessionModel,
} from './acp-session';

/**
 * Cross-process wire format for ACP session events.
 * The renderer reduces these into IChatMessage[] via ACPConversationReducer.
 */
export type IACPStreamEvent =
  | IACPSessionStatusEvent
  | IACPMessageUpsertEvent
  | IACPPartAppendEvent
  | IACPToolUpdateEvent
  | IACPPlanEvent
  | IACPPermissionRequestedEvent
  | IACPPermissionResolvedEvent
  | IACPModeUpdateEvent
  | IACPCommandsUpdateEvent
  | IACPModelsUpdateEvent
  | IACPTitleUpdateEvent
  | IACPTurnCompleteEvent
  | IACPErrorEvent
  | IACPHistoryReplayStartEvent
  | IACPHistoryReplayEndEvent;

export interface IACPSessionStatusEvent {
  type: 'session_status';
  status: ACPSessionStatus;
  errorMessage?: string;
}

/** Replace or insert a full message (user prompt echo, history replay). */
export interface IACPMessageUpsertEvent {
  type: 'message_upsert';
  message: IChatMessage;
}

/** Stream a part onto the current assistant message (text/thinking chunks). */
export interface IACPPartAppendEvent {
  type: 'part_append';
  messageId: string;
  part: IMessagePart;
  /** When true, append text/thinking into the last matching part rather than push. */
  merge?: boolean;
}

/** Create or update a tool part by toolCallId. */
export interface IACPToolUpdateEvent {
  type: 'tool_update';
  messageId: string;
  part: Extract<IMessagePart, { type: 'tool' }>;
}

export interface IACPPlanEvent {
  type: 'plan';
  messageId: string;
  entries: IPlanEntry[];
}

export interface IACPPermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

export interface IACPPermissionRequest {
  requestId: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  title?: string;
  options: IACPPermissionOption[];
  input?: unknown;
  createdAt: number;
}

export interface IACPPermissionRequestedEvent {
  type: 'permission_requested';
  request: IACPPermissionRequest;
}

export interface IACPPermissionResolvedEvent {
  type: 'permission_resolved';
  requestId: string;
  optionId?: string;
  cancelled?: boolean;
}

export interface IACPModeUpdateEvent {
  type: 'mode_update';
  currentModeId?: string;
  availableModes?: IACPSessionMode[];
}

export interface IACPCommandsUpdateEvent {
  type: 'commands_update';
  commands: IACPAvailableCommand[];
}

export interface IACPModelsUpdateEvent {
  type: 'models_update';
  currentModelId?: string;
  availableModels?: IACPSessionModel[];
}

export interface IACPTitleUpdateEvent {
  type: 'title_update';
  title: string;
}

export interface IACPTurnCompleteEvent {
  type: 'turn_complete';
  stopReason: 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';
}

export interface IACPErrorEvent {
  type: 'error';
  message: string;
}

export interface IACPHistoryReplayStartEvent {
  type: 'history_replay_start';
}

export interface IACPHistoryReplayEndEvent {
  type: 'history_replay_end';
  messages: IChatMessage[];
}
