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

import type {
  ISuggestedRule,
  IToolInputHighlight,
  ToolRiskLevel,
} from '../models/agent-tool-permission';
import type { AgentToolCategory } from '../models/tool';
import type { IGuardMetadata } from './agent-tool-permission.service';
import { createIdentifier } from '@termlnk/core';

export interface IRiskAssessment {
  level: ToolRiskLevel;
  reason: string;
  highlight?: IToolInputHighlight;
}

export interface IRiskAssessmentService {
  /**
   * Evaluates risk based on tool metadata + input.
   *
   * Strategy:
   *  - termlnk_terminal_run: per-command evaluation (preserves SSH critical-command rule)
   *  - other built-in: isDestructive ? dangerous : isReadOnly ? safe : caution
   *  - mcp_*: trusts user configuration → safe by default (Q5=C decision)
   *  - skill_*: caution by default
   */
  assess(
    toolName: string,
    input: unknown,
    category: AgentToolCategory,
    metadata?: IGuardMetadata
  ): IRiskAssessment;

  /** True when the tool is read-only (used by plan-mode). */
  isReadOnly(toolName: string, category: AgentToolCategory, metadata?: IGuardMetadata): boolean;

  /** Generates "Allow always" suggestion list for a given call. */
  generateSuggestedRules(
    toolName: string,
    input: unknown,
    category: AgentToolCategory
  ): ISuggestedRule[];
}

export const IRiskAssessmentService = createIdentifier<IRiskAssessmentService>(
  'agent.risk-assessment-service'
);
