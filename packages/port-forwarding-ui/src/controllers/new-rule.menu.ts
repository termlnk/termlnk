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

import type { IMenuButtonItem } from '@termlnk/ui';
import { PortForwardingType } from '@termlnk/rpc';
import { MenuItemType } from '@termlnk/ui';
import { CreateRuleCommand } from '../commands/create-rule.command';

/** Anchored dropdown opened by the "+ New forwarding" chevron. */
export const PORT_FORWARDING_NEW_RULE_MENU = 'port-forwarding-ui.dropdown.new-rule';

export function CreateLocalRuleMenuFactory(): IMenuButtonItem {
  return {
    id: `${CreateRuleCommand.id}.local`,
    commandId: CreateRuleCommand.id,
    params: { type: PortForwardingType.LOCAL },
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.list.newLocal',
  };
}

export function CreateRemoteRuleMenuFactory(): IMenuButtonItem {
  return {
    id: `${CreateRuleCommand.id}.remote`,
    commandId: CreateRuleCommand.id,
    params: { type: PortForwardingType.REMOTE },
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.list.newRemote',
  };
}

export function CreateDynamicRuleMenuFactory(): IMenuButtonItem {
  return {
    id: `${CreateRuleCommand.id}.dynamic`,
    commandId: CreateRuleCommand.id,
    params: { type: PortForwardingType.DYNAMIC },
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.list.newDynamic',
  };
}
