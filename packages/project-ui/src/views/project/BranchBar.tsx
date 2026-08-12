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

import { cn, useDependency, useObservable } from '@termlnk/design';
import { IContextMenuService } from '@termlnk/ui';
import { ChevronDown, GitBranch } from 'lucide-react';
import { useCallback } from 'react';
import { BRANCH_MENU } from '../../common/constants';
import { IProjectPanelService } from '../../services/project-panel.service';

/**
 * Current branch plus the switcher. The branch list is a menu-system selector
 * (see ProjectUIController) rather than a hand-rolled dropdown, so it inherits
 * the shortcut display and command plumbing every other menu has.
 */
export function BranchBar() {
  const panel = useDependency(IProjectPanelService);
  const contextMenuService = useDependency(IContextMenuService);
  const branch = useObservable(panel.branch$, null);

  const openSwitcher = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // Fetch on open: branches change outside the app and a stale list would
    // silently check out something that no longer exists.
    void panel.refreshBranches();
    contextMenuService.triggerContextMenu(event.nativeEvent, BRANCH_MENU);
  }, [contextMenuService, panel]);

  return (
    <div
      className={cn('tm:flex tm:h-8 tm:shrink-0 tm:items-center tm:gap-1 tm:border-b tm:border-line tm:px-1.5')}
    >
      <button
        type="button"
        onClick={openSwitcher}
        className={cn(`
          tm:flex tm:h-6 tm:min-w-0 tm:items-center tm:gap-1.5 tm:rounded-md tm:px-1.5 tm:text-xs tm:text-light-grey
          tm:transition-colors
          tm:hover:bg-one-bg2
        `)}
      >
        <GitBranch size={12} className="tm:shrink-0 tm:text-nord-blue" />
        <span className="tm:truncate">{branch?.name ?? '…'}</span>
        <ChevronDown size={12} className="tm:shrink-0 tm:text-grey" />
      </button>
      {branch && branch.ahead > 0 && (
        <span className="tm:shrink-0 tm:text-[11px] tm:text-green">
          ↑
          {branch.ahead}
        </span>
      )}
      {branch && branch.behind > 0 && (
        <span className="tm:shrink-0 tm:text-[11px] tm:text-yellow">
          ↓
          {branch.behind}
        </span>
      )}
    </div>
  );
}
