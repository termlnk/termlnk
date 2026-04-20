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

export type CommandRiskLevel = 'safe' | 'caution' | 'dangerous';
export type PermissionDecision = 'allow' | 'deny' | 'pending';
export type PermissionMode = 'default' | 'auto' | 'strict';

export interface ICommandPermissionRequest {
  id: string;
  sessionId: string;
  command: string;
  riskLevel: CommandRiskLevel;
  reason: string;
  suggestedAlternative?: string;
  timestamp: number;
}

export interface ICommandPermissionResponse {
  requestId: string;
  decision: 'allow' | 'deny';
  rememberForSession?: boolean;
}

export interface ICommandEvaluation {
  riskLevel: CommandRiskLevel;
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  suggestedAlternative?: string;
}
