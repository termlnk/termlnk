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

import type { Nullable } from '@termlnk/core';
import type { IPaneToTabDragState, ITabItem } from '../../models/workspace.model';
import type { ITerminalSession } from '../../services/terminal/terminal-ui.service';
import { useDependency, useObservable } from '@termlnk/design';
import { DEFAULT_PAGE_ID, IContentRouterService } from '@termlnk/ui';
import { useCallback } from 'react';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { ITerminalViewRegistry } from '../../services/terminal/terminal-view-registry.service';
import { IWorkspaceService } from '../../services/workspace/workspace.service';
import { TerminalTabs } from './TerminalTabs';
import { useTabDisplayItems } from './use-tab-display-items';

export function TerminalTabBar() {
  const terminalUIService = useDependency(ITerminalUIService);
  const workspaceService = useDependency(IWorkspaceService);
  const viewRegistry = useDependency(ITerminalViewRegistry);
  const contentRouterService = useDependency(IContentRouterService);

  const sessions = useObservable<ITerminalSession[]>(terminalUIService.sessions$, []);
  const tabItems = useObservable<ITabItem[]>(workspaceService.tabItems$, []);
  const activeTabItemId = useObservable<Nullable<string>>(workspaceService.activeTabItemId$);
  const addSessionHandler = useObservable(viewRegistry.addSessionHandler$, undefined);
  const activePage = useObservable(contentRouterService.activePage$, DEFAULT_PAGE_ID);
  const paneToTabDrag = useObservable<IPaneToTabDragState | null>(workspaceService.paneToTabDrag$, null);

  // When a non-terminal page (e.g. SFTP) is active, no terminal tab should be highlighted
  const effectiveActiveTabItemId = activePage === DEFAULT_PAGE_ID ? activeTabItemId : null;

  const displayItems = useTabDisplayItems(tabItems, sessions, workspaceService);

  /** Navigate back to the terminal page if currently on a different page. */
  const ensureTerminalPage = useCallback(() => {
    if (contentRouterService.activePage !== DEFAULT_PAGE_ID) {
      contentRouterService.navigate(DEFAULT_PAGE_ID);
    }
  }, [contentRouterService]);

  const handleSelectTab = useCallback((id: string) => {
    ensureTerminalPage();
    workspaceService.setActiveTabItem(id);
  }, [workspaceService, ensureTerminalPage]);

  const handleCloseTab = useCallback((id: string) => {
    workspaceService.removeTabItem(id);
  }, [workspaceService]);

  const handleReorderTab = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    workspaceService.moveTabItem(sourceId, targetId, position);
  }, [workspaceService]);

  const handleMergeTab = useCallback((sourceId: string, targetId: string) => {
    workspaceService.mergeTwoSessions(sourceId, targetId);
  }, [workspaceService]);

  const handleAddSession = useCallback(() => {
    ensureTerminalPage();
    addSessionHandler?.();
  }, [addSessionHandler, ensureTerminalPage]);

  return (
    <TerminalTabs
      items={displayItems}
      activeTabItemId={effectiveActiveTabItemId}
      externalDragDropIndex={paneToTabDrag?.dropIndex}
      onSelectTab={handleSelectTab}
      onCloseTab={handleCloseTab}
      onReorderTab={handleReorderTab}
      onMergeTab={handleMergeTab}
      onAddSession={addSessionHandler ? handleAddSession : undefined}
    />
  );
}
