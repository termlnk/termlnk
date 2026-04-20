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
import { FilesIconKey } from '@termlnk/design';
import { MenuItemType, SideTabBarService } from '@termlnk/ui';
import { map, of } from 'rxjs';
import { ToggleHostsPanelCommand } from '../../commands/toggle-hosts-panel.command';
import { HOSTS_EXPLORER_NAME } from '../../views/hosts-explorer/component-name';

export function hostsMenuFactory(accessor: IAccessor): IMenuItem {
  const sideTabBarService = accessor.get(SideTabBarService);
  return {
    id: ToggleHostsPanelCommand.id,
    type: MenuItemType.BUTTON,
    componentId: HOSTS_EXPLORER_NAME,
    title: 'terminal-ui.menu.host',
    tooltip: 'terminal-ui.menu.host',
    icon: FilesIconKey,
    hidden$: of(false),
    activated$: sideTabBarService.active$.pipe(
      map((id) => id === ToggleHostsPanelCommand.id)
    ),
  };
}
