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

import type { MenuSchemaType } from '@termlnk/ui';
import { MenuPosition } from '@termlnk/ui';
import { CreateRuleCommand } from '../commands/create-rule.command';
import { DeleteRuleCommand, EditRuleCommand } from '../commands/edit-rule.command';
import { StartRuleCommand } from '../commands/start-rule.command';
import { RestartRuleCommand, StopRuleCommand } from '../commands/stop-rule.command';
import { ToggleForwardingPanelCommand } from '../commands/toggle-forwarding-panel.command';
import { CreateDynamicRuleMenuFactory, CreateLocalRuleMenuFactory, CreateRemoteRuleMenuFactory, PORT_FORWARDING_NEW_RULE_MENU } from './new-rule.menu';
import { portForwardingSideTabMenuFactory } from './port-forwarding-side-tab.menu';
import { DeleteRuleMenuFactory, EditRuleMenuFactory, PORT_FORWARDING_RULE_CONTEXT_MENU, RestartRuleMenuFactory, StartRuleMenuFactory, StopRuleMenuFactory } from './rule-context.menu';

export const portForwardingMenuSchema: MenuSchemaType = {
  [MenuPosition.SIDE_TAB_BAR]: {
    [ToggleForwardingPanelCommand.id]: {
      order: 8,
      menuItemFactory: portForwardingSideTabMenuFactory,
    },
  },
  [PORT_FORWARDING_NEW_RULE_MENU]: {
    [`${CreateRuleCommand.id}.local`]: { order: 0, menuItemFactory: CreateLocalRuleMenuFactory },
    [`${CreateRuleCommand.id}.remote`]: { order: 1, menuItemFactory: CreateRemoteRuleMenuFactory },
    [`${CreateRuleCommand.id}.dynamic`]: { order: 2, menuItemFactory: CreateDynamicRuleMenuFactory },
  },
  [PORT_FORWARDING_RULE_CONTEXT_MENU]: {
    [StartRuleCommand.id]: { order: 0, menuItemFactory: StartRuleMenuFactory },
    [StopRuleCommand.id]: { order: 1, menuItemFactory: StopRuleMenuFactory },
    [RestartRuleCommand.id]: { order: 2, menuItemFactory: RestartRuleMenuFactory },
    [EditRuleCommand.id]: { order: 3, menuItemFactory: EditRuleMenuFactory },
    [DeleteRuleCommand.id]: { order: 4, menuItemFactory: DeleteRuleMenuFactory },
  },
};
