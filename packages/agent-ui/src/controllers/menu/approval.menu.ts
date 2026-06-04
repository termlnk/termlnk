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

import type { IAccessor } from '@termlnk/core';
import type { IMenuSelectorItem } from '@termlnk/ui';
import { MenuItemType } from '@termlnk/ui';
import { AllowAlwaysCommand } from '../../commands/approval/allow-always.command';
import { ApprovalMenuService } from '../../services/approval/approval-menu.service';

/** Anchored dropdown opened by the "allow always" button in PendingApprovalBar. */
export const APPROVAL_MENU = 'agent-ui.context-menu.approval';

export function allowAlwaysMenuFactory(accessor: IAccessor): IMenuSelectorItem {
  const menuService = accessor.get(ApprovalMenuService);
  return {
    id: 'agent-ui.approval.allow-always',
    type: MenuItemType.SELECTOR,
    selections: menuService.selections$,
    selectionsCommandId: AllowAlwaysCommand.id,
  };
}
