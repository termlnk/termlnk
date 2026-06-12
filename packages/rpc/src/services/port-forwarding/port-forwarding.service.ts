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
import type { IPortForwardingRule, IPortForwardingRuleCreateInput, IPortForwardingRuleUpdateInput, IPortForwardingRuntimeState, PortForwardingAuthEvent, PortForwardingHostKeyAction } from '../../models/port-forwarding';
import { createIdentifier } from '@termlnk/core';

export interface IPortForwardingService {
  listRules(): Promise<IPortForwardingRule[]>;
  createRule(input: IPortForwardingRuleCreateInput): Promise<IPortForwardingRule>;
  updateRule(id: string, patch: IPortForwardingRuleUpdateInput): Promise<IPortForwardingRule>;
  deleteRule(id: string): Promise<void>;

  startRule(ruleId: string, options?: { password?: string }): Promise<void>;
  stopRule(ruleId: string): Promise<void>;
  restartRule(ruleId: string, options?: { password?: string }): Promise<void>;

  respondKeyboardInteractive(ruleId: string, responses: string[]): Promise<void>;
  respondChangePassword(ruleId: string, newPassword: string): Promise<void>;
  respondHostKeyPrompt(ruleId: string, action: PortForwardingHostKeyAction): Promise<void>;

  readonly rules$: Observable<IPortForwardingRule[]>;
  state$(ruleId: string): Observable<IPortForwardingRuntimeState>;
  authEvent$(ruleId: string): Observable<PortForwardingAuthEvent>;
}
export const IPortForwardingService = createIdentifier<IPortForwardingService>('rpc.port-forwarding-service');
