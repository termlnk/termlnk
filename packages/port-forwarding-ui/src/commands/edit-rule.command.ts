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
import { IRuleDialogService } from '../services/rule-dialog/rule-dialog.service';
import { resolveRuleId } from './start-rule.command';

export const EditRuleCommand: ICommand<IRuleIdParams> = {
  id: 'port-forwarding-ui.command.edit-rule',
  handler: (accessor: IAccessor, params?: IRuleIdParams): boolean => {
    const ruleId = resolveRuleId(accessor, params);
    if (!ruleId) return false;
    accessor.get(IRuleDialogService).openEdit(ruleId);
    return true;
  },
};

export const DeleteRuleCommand: ICommand<IRuleIdParams> = {
  id: 'port-forwarding-ui.command.delete-rule',
  handler: async (accessor: IAccessor, params?: IRuleIdParams): Promise<boolean> => {
    const ruleId = resolveRuleId(accessor, params);
    if (!ruleId) return false;
    const service = accessor.get(IPortForwardingService);
    await service.stopRule(ruleId).catch(() => {});
    await service.deleteRule(ruleId);
    return true;
  },
};
