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
import type { IRuleIdParams } from './start-rule.command';
import { IPortForwardingService } from '@termlnk/rpc';
import { resolveRuleId } from './start-rule.command';

export const StopRuleCommand: ICommand<IRuleIdParams> = {
  id: 'port-forwarding-ui.command.stop-rule',
  handler: async (accessor: IAccessor, params?: IRuleIdParams): Promise<boolean> => {
    const ruleId = resolveRuleId(accessor, params);
    if (!ruleId) {
      return false;
    }
    await accessor.get(IPortForwardingService).stopRule(ruleId);
    return true;
  },
};

export const RestartRuleCommand: ICommand<IRuleIdParams> = {
  id: 'port-forwarding-ui.command.restart-rule',
  handler: async (accessor: IAccessor, params?: IRuleIdParams): Promise<boolean> => {
    const ruleId = resolveRuleId(accessor, params);
    if (!ruleId) {
      return false;
    }
    await accessor.get(IPortForwardingService).restartRule(ruleId);
    return true;
  },
};
