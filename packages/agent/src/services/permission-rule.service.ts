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
  IPermissionRule,
  IPermissionRuleInput,
  ToolPermissionScope,
} from '../models/agent-tool-permission';
import { createIdentifier } from '@termlnk/core';

/** A rule that is unreachable because a broader rule on the same tool overrides it. */
export interface IShadowedRule {
  rule: IPermissionRule;
  shadowedBy: IPermissionRule;
  reason: 'tool-level-deny' | 'tool-level-allow';
}

export interface IPermissionRuleService {
  readonly rules$: Observable<IPermissionRule[]>;

  /**
   * Highest-priority rule for (toolName, input, sessionId), or null if none matches.
   * Priority: user-deny > session-deny > user-allow > session-allow.
   */
  match(toolName: string, input: unknown, sessionId: string): IPermissionRule | null;

  /** Persists to agent.config.permissionRules (subKey). */
  addUserRule(input: Omit<IPermissionRuleInput, 'scope'>): Promise<IPermissionRule>;

  /** In-memory only, keyed by sessionId. */
  addSessionRule(sessionId: string, input: Omit<IPermissionRuleInput, 'scope'>): IPermissionRule;

  /** Removes a rule by id (handles both scopes). */
  removeRule(ruleId: string): Promise<void>;

  /** Lists rules in declaration order; if scope omitted returns user ∪ all-sessions. */
  listRules(scope?: ToolPermissionScope): IPermissionRule[];

  /** Clears every session-scope rule belonging to the given chat session. */
  clearSessionRules(sessionId: string): void;

  /** PR4: detects rules masked by broader tool-wide rules. */
  detectShadowedRules(): IShadowedRule[];
}

export const IPermissionRuleService = createIdentifier<IPermissionRuleService>(
  'agent.permission-rule-service'
);
