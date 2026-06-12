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
import { PortForwardingType } from '@termlnk/rpc';
import { IRuleDialogService } from '../services/rule-dialog/rule-dialog.service';

export interface ICreateRuleCommandParams {
  type: PortForwardingType;
}

export const CreateRuleCommand: ICommand<ICreateRuleCommandParams> = {
  id: 'port-forwarding-ui.command.create-rule',
  handler: (accessor: IAccessor, params?: ICreateRuleCommandParams): boolean => {
    const type = params?.type ?? PortForwardingType.LOCAL;
    accessor.get(IRuleDialogService).openCreate(type);
    return true;
  },
};
