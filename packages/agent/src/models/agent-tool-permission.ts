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

import type { AgentToolCategory } from './tool';

export type ToolPermissionDecision = 'allow' | 'deny';
export type ToolPermissionScope = 'once' | 'session' | 'user';
export type ToolPermissionMode = 'default' | 'auto' | 'strict' | 'plan';
export type ToolRiskLevel = 'safe' | 'caution' | 'dangerous';

/** Highlights a primary input field for UI emphasis (e.g. command, path, url). */
export interface IToolInputHighlight {
  field: string;
  value: string;
}

/** A tool invocation pending user approval. */
export interface IAgentToolPermissionRequest {
  id: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  toolDisplayName?: string;
  toolCategory: AgentToolCategory;
  /**
   * Original tool input. Marked optional so the type round-trips cleanly through
   * the tRPC zod-inferred shape (which renders unknown fields as optional). The
   * service always populates it.
   */
  input?: unknown;
  highlight?: IToolInputHighlight;
  riskLevel: ToolRiskLevel;
  reason?: string;
  suggestedRules?: ISuggestedRule[];
  decisionReason?: IPermissionDecisionReason;
  createdAt: number;
}

export interface ISuggestedRule {
  /** Human-readable label, e.g. "For commands matching npm:*" */
  label: string;
  /** Pattern; undefined means tool-wide (no argument matching). */
  pattern?: string;
  /** Field to match against (e.g. 'command', 'path'). */
  matchField?: string;
  decision: ToolPermissionDecision;
}

export interface IAgentToolPermissionResponse {
  requestId: string;
  decision: ToolPermissionDecision;
  scope: ToolPermissionScope;
  /**
   * When user picks "Allow always", this rule is persisted. The scope of the
   * persisted rule comes from the outer scope field above (so 'once' means no
   * rule).
   */
  rule?: Omit<IPermissionRuleInput, 'scope'>;
  /** When user edits the input before approval (D1 borrowed from openclaude). */
  updatedInput?: unknown;
}

export interface IPermissionRule {
  id: string;
  toolName: string;
  pattern?: string;
  matchField?: string;
  decision: ToolPermissionDecision;
  scope: Exclude<ToolPermissionScope, 'once'>;
  createdAt: number;
}

/** Shape used when adding a new rule (server assigns id and createdAt). */
export type IPermissionRuleInput = Omit<IPermissionRule, 'id' | 'createdAt'>;

export interface IPermissionDecisionReason {
  type: 'rule' | 'mode' | 'plan-mode' | 'user-decision';
  ruleId?: string;
  modeMatrix?: { mode: ToolPermissionMode; risk: ToolRiskLevel };
}
