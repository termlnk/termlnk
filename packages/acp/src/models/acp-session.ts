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

import type { IChatMessage, IImageAttachment } from '@termlnk/agent';

export type ACPSessionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'streaming'
  | 'error'
  | 'closed';

export interface IACPSessionMode {
  id: string;
  name: string;
  description?: string;
}

export interface IACPSessionModel {
  id: string;
  name: string;
}

export interface IACPAvailableCommand {
  name: string;
  description?: string;
  inputHint?: string;
}

export interface IACPSessionInfo {
  /** Termlnk session id (= tab session id). */
  id: string;
  providerId: string;
  providerTitle: string;
  cwd: string;
  status: ACPSessionStatus;
  /** The agent's own session id; resume handle for session/load. */
  nativeSessionId?: string;
  title?: string;
  currentModeId?: string;
  availableModes?: IACPSessionMode[];
  currentModelId?: string;
  availableModels?: IACPSessionModel[];
  availableCommands?: IACPAvailableCommand[];
  errorMessage?: string;
  /** Reserved for agents launched against a remote host. */
  hostId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ICreateACPSessionParams {
  providerId: string;
  cwd: string;
  /** Reuse a previously persisted Termlnk session id (resume path). */
  sessionId?: string;
  /** Prefer loadSession when the agent supports it and a native id is known. */
  nativeSessionId?: string;
  hostId?: string;
}

/** One content block in a user prompt (text or image). */
export type IACPPromptBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; image: IImageAttachment };

export interface IACPSessionState {
  session: IACPSessionInfo;
  messages: IChatMessage[];
  isStreaming: boolean;
  currentMessage: IChatMessage | null;
}
