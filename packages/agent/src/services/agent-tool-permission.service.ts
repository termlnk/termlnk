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

import type { Observable } from 'rxjs';
import type {
  IAgentToolPermissionRequest,
  IAgentToolPermissionResponse,
  IPermissionRule,
  ToolPermissionMode,
} from '../models/agent-tool-permission';
import type { AgentToolCategory } from '../models/tool';
import { createIdentifier } from '@termlnk/core';

/**
 * Per-call metadata used by RiskAssessmentService.
 * Populated by the caller (typically McpController during tool wrap).
 */
export interface IGuardMetadata {
  /** Terminal-only: whether the target session is SSH or local PTY. */
  terminalSessionType?: 'ssh' | 'local';
  /** Mirrored from MCP tool annotations.readOnlyHint. */
  readOnlyHint?: boolean;
  /** Mirrored from IAgentTool.isReadOnly. */
  isReadOnly?: boolean;
  /** Mirrored from IAgentTool.isDestructive. */
  isDestructive?: boolean;
  /** Mirrored from IAgentTool.label. */
  toolDisplayName?: string;
}

export interface IGuardInput {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  toolCategory: AgentToolCategory;
  input: unknown;
  signal?: AbortSignal;
  metadata?: IGuardMetadata;
  /** Set to true for user-initiated invokes (D1 — bypasses approval). */
  userInitiated?: boolean;
}

export type IGuardResult =
  | { decision: 'allow'; via: 'rule' | 'mode' | 'user'; updatedInput?: unknown; rule?: IPermissionRule }
  | { decision: 'deny'; via: 'rule' | 'mode' | 'plan-mode' | 'user'; reason: string };

export interface IAgentToolPermissionService {
  readonly mode$: Observable<ToolPermissionMode>;
  readonly pendingRequests$: Observable<IAgentToolPermissionRequest[]>;

  getMode(): ToolPermissionMode;
  setMode(mode: ToolPermissionMode): void;

  /**
   * Single entry point for tool-call gating. Returns synchronously when a rule
   * or mode decides; otherwise pushes a request to pendingRequests$ and waits
   * for respond(). Honors signal.aborted.
   */
  guard(input: IGuardInput): Promise<IGuardResult>;

  respond(response: IAgentToolPermissionResponse): void;

  clearSessionRules(sessionId: string): void;
}

export const IAgentToolPermissionService = createIdentifier<IAgentToolPermissionService>(
  'agent.tool-permission-service'
);
