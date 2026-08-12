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

import { Button, useDependency, useObservable } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { Eye, EyeOff, List, ListTree, RefreshCw, UnfoldVertical } from 'lucide-react';
import { IProjectPanelService } from '../../services/project-panel.service';

/** Tab-bar buttons for the Changes tab. */
export function ChangesActions() {
  const panel = useDependency(IProjectPanelService);
  const viewMode = useObservable(panel.viewMode$, 'tree');
  const collapsed = useObservable(panel.collapsedDirs$, new Set<string>() as ReadonlySet<string>);
  const busy = useObservable(panel.busy$, false);

  const allCollapsed = collapsed.size > 0;

  return (
    <>
      <TooltipWrapper
        side="bottom"
        labelKey={allCollapsed ? 'project-ui.changes.expand-all' : 'project-ui.changes.collapse-all'}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={viewMode === 'flat'}
          onClick={() => panel.setAllCollapsed(!allCollapsed)}
        >
          <UnfoldVertical size={14} />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper
        side="bottom"
        labelKey={viewMode === 'tree' ? 'project-ui.changes.view-flat' : 'project-ui.changes.view-tree'}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => panel.setViewMode(viewMode === 'tree' ? 'flat' : 'tree')}
        >
          {viewMode === 'tree' ? <List size={14} /> : <ListTree size={14} />}
        </Button>
      </TooltipWrapper>
      <TooltipWrapper side="bottom" labelKey="project-ui.explorer.refresh">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy}
          onClick={() => void panel.refreshStatus()}
        >
          <RefreshCw size={14} />
        </Button>
      </TooltipWrapper>
    </>
  );
}

/** Tab-bar buttons for the Files tab. */
export function FilesActions() {
  const panel = useDependency(IProjectPanelService);
  const showHidden = useObservable(panel.showHiddenFiles$, false);

  return (
    <>
      <TooltipWrapper
        side="bottom"
        labelKey={showHidden ? 'project-ui.explorer.hide-hidden' : 'project-ui.explorer.show-hidden'}
      >
        <Button variant="ghost" size="icon-xs" onClick={() => panel.toggleHiddenFiles()}>
          {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
      </TooltipWrapper>
      <TooltipWrapper side="bottom" labelKey="project-ui.explorer.refresh">
        <Button variant="ghost" size="icon-xs" onClick={() => panel.requestFileTreeRefresh()}>
          <RefreshCw size={14} />
        </Button>
      </TooltipWrapper>
    </>
  );
}
