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

import type { IAccessor, ICommand } from '@termlnk/core';
import { IPortForwardingService } from '@termlnk/rpc';
import { IRuleContextService } from '../services/rule-context/rule-context.service';

export interface IRuleIdParams {
  ruleId: string;
}

// Resolve the rule id from explicit params (toggle button click) or from the
// rule-context service (right-click menu set the target before triggering).
export function resolveRuleId(accessor: IAccessor, params?: IRuleIdParams): string | null {
  return params?.ruleId ?? accessor.get(IRuleContextService).target?.rule.id ?? null;
}

export const StartRuleCommand: ICommand<IRuleIdParams> = {
  id: 'port-forwarding-ui.command.start-rule',
  handler: async (accessor: IAccessor, params?: IRuleIdParams): Promise<boolean> => {
    const ruleId = resolveRuleId(accessor, params);
    if (!ruleId) {
      return false;
    }
    await accessor.get(IPortForwardingService).startRule(ruleId);
    return true;
  },
};
