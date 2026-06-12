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
import type { IMenuButtonItem } from '@termlnk/ui';
import { PortForwardingTunnelStatus } from '@termlnk/rpc';
import { MenuItemType } from '@termlnk/ui';
import { map } from 'rxjs';
import { DeleteRuleCommand, EditRuleCommand } from '../commands/edit-rule.command';
import { StartRuleCommand } from '../commands/start-rule.command';
import { RestartRuleCommand, StopRuleCommand } from '../commands/stop-rule.command';
import { IRuleContextService } from '../services/rule-context/rule-context.service';

/** Right-click menu on a rule list item. */
export const PORT_FORWARDING_RULE_CONTEXT_MENU = 'port-forwarding-ui.context-menu.rule';

function isRunning(status: PortForwardingTunnelStatus | undefined): boolean {
  return status === PortForwardingTunnelStatus.ACTIVE
    || status === PortForwardingTunnelStatus.STARTING
    || status === PortForwardingTunnelStatus.AUTHENTICATING;
}

export function StartRuleMenuFactory(accessor: IAccessor): IMenuButtonItem {
  const ctx = accessor.get(IRuleContextService);
  return {
    id: StartRuleCommand.id,
    commandId: StartRuleCommand.id,
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.action.start',
    hidden$: ctx.target$.pipe(map((t) => isRunning(t?.status))),
  };
}

export function StopRuleMenuFactory(accessor: IAccessor): IMenuButtonItem {
  const ctx = accessor.get(IRuleContextService);
  return {
    id: StopRuleCommand.id,
    commandId: StopRuleCommand.id,
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.action.stop',
    hidden$: ctx.target$.pipe(map((t) => !isRunning(t?.status))),
  };
}

export function RestartRuleMenuFactory(accessor: IAccessor): IMenuButtonItem {
  const ctx = accessor.get(IRuleContextService);
  return {
    id: RestartRuleCommand.id,
    commandId: RestartRuleCommand.id,
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.action.restart',
    hidden$: ctx.target$.pipe(map((t) => !isRunning(t?.status))),
  };
}

export function EditRuleMenuFactory(): IMenuButtonItem {
  return {
    id: EditRuleCommand.id,
    commandId: EditRuleCommand.id,
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.action.edit',
  };
}

export function DeleteRuleMenuFactory(): IMenuButtonItem {
  return {
    id: DeleteRuleCommand.id,
    commandId: DeleteRuleCommand.id,
    type: MenuItemType.BUTTON,
    title: 'port-forwarding-ui.action.delete',
  };
}
