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
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToggleSnippetsPanelCommand } from '../commands/toggle-snippets-panel.command';
import { SNIPPETS_EXPLORER_NAME, SNIPPETS_ICON_KEY } from '../common/constants';

export function snippetsMenuFactory(accessor: IAccessor): IMenuItem {
  const sideTabBarService = accessor.get(SideTabBarService);
  return {
    id: ToggleSnippetsPanelCommand.id,
    type: MenuItemType.BUTTON,
    componentId: SNIPPETS_EXPLORER_NAME,
    title: 'snippet-ui.menu.snippets',
    tooltip: 'snippet-ui.menu.snippets',
    icon: SNIPPETS_ICON_KEY,
    hidden$: of(false),
    activated$: sideTabBarService.active$.pipe(
      map((id) => id === ToggleSnippetsPanelCommand.id)
    ),
  };
}
