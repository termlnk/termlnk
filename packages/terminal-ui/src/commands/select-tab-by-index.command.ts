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
import { DEFAULT_PAGE_ID, IContentRouterService } from '@termlnk/ui';
import { IWorkspaceService } from '../services/workspace/workspace.service';

export interface ISelectTabByIndexCommandParams {
  /** Zero-based index of the tab to activate, matching the tab bar order. */
  index: number;
}

export const SelectTabByIndexCommand: ICommand<ISelectTabByIndexCommandParams> = {
  id: 'terminal-ui.command.select-tab-by-index',
  handler: (accessor: IAccessor, params?: ISelectTabByIndexCommandParams) => {
    if (!params) {
      return false;
    }

    const workspaceService = accessor.get(IWorkspaceService);
    const targetId = workspaceService.getTabItemOrder()[params.index];
    if (!targetId) {
      return false;
    }

    // Mirror clicking a tab: surface the terminal page before activating it.
    const contentRouterService = accessor.get(IContentRouterService);
    if (contentRouterService.activePage !== DEFAULT_PAGE_ID) {
      contentRouterService.navigate(DEFAULT_PAGE_ID);
    }

    workspaceService.setActiveTabItem(targetId);
    return true;
  },
};
