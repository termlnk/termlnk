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
import type { IMenuItem } from '@termlnk/ui';
import { MenuItemType, SideTabBarService } from '@termlnk/ui';
import { map, of } from 'rxjs';
import { ToggleForwardingPanelCommand } from '../commands/toggle-forwarding-panel.command';
import { PORT_FORWARDING_EXPLORER_NAME, PORT_FORWARDING_ICON_NAME } from './component-names';

export function portForwardingSideTabMenuFactory(accessor: IAccessor): IMenuItem {
  const sideTabBarService = accessor.get(SideTabBarService);
  return {
    id: ToggleForwardingPanelCommand.id,
    type: MenuItemType.BUTTON,
    componentId: PORT_FORWARDING_EXPLORER_NAME,
    title: 'port-forwarding-ui.menu.title',
    tooltip: 'port-forwarding-ui.menu.title',
    icon: PORT_FORWARDING_ICON_NAME,
    hidden$: of(false),
    activated$: sideTabBarService.active$.pipe(
      map((id) => id === ToggleForwardingPanelCommand.id)
    ),
  };
}
