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
import { ResizableService } from '../services/resizable/resizable.service';
import { SideTabBarService } from '../services/side-tab-bar/side-tab-bar.service';

export const ToggleLeftSidebarCommand: ICommand = {
  id: 'ui.command.toggle-left-sidebar',
  handler: (accessor: IAccessor): boolean => {
    const sideTabBarService = accessor.get(SideTabBarService);
    const resizableService = accessor.get(ResizableService);

    const nextVisible = !sideTabBarService.visible;

    if (!nextVisible) {
      sideTabBarService.setVisible(false);
      resizableService.collapse('left');
    } else {
      sideTabBarService.setVisible(true);
      if (sideTabBarService.panelExpandedOnHide) {
        resizableService.expand('left');
      }
    }

    return true;
  },
};
