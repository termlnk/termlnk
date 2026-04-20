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
import { BotIconKey } from '@termlnk/design';
import { MenuItemType, ToggleRightSidebarCommand } from '@termlnk/ui';
import { of } from 'rxjs';
import { ToggleAIPanelCommand } from '../../commands/toggle-ai-panel.command';

export function aiPanelMenuFactory(_accessor: IAccessor): IMenuItem {
  return {
    id: ToggleAIPanelCommand.id,
    commandId: ToggleRightSidebarCommand.id,
    type: MenuItemType.BUTTON,
    componentId: '',
    title: 'agent-ui.menu.ai-panel',
    tooltip: 'agent-ui.menu.ai-panel',
    icon: BotIconKey,
    hidden$: of(false),
    activated$: of(false),
  };
}
