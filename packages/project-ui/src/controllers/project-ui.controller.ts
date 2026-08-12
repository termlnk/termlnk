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

import type { IMenuSelectorItem, MenuSchemaType } from '@termlnk/ui';
import { ICommandService, Inject, Injector, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IProjectContextService } from '@termlnk/project';
import { IMenuManagerService, IShortcutService, ISidePanelService, KeyCode, MenuItemType, MetaKeys } from '@termlnk/ui';
import { combineLatest, map } from 'rxjs';
import { CheckoutBranchCommand } from '../commands/checkout-branch.command';
import { FocusExplorerFilterCommand } from '../commands/focus-explorer-filter.command';
import { ToggleExplorerPanelCommand } from '../commands/toggle-explorer-panel.command';
import { ToggleGitPanelCommand } from '../commands/toggle-git-panel.command';
import {
  BRANCH_MENU,
  EXPLORER_FOCUSED_CONTEXT,
  PROJECT_EXPLORER_PANEL_ID,
  PROJECT_GIT_PANEL_ID,
} from '../common/constants';
import { IProjectPanelService } from '../services/project-panel.service';
import { ProjectChangesPanel, ProjectFilesPanel } from '../views/project/ProjectPanel';
import { ChangesActions, FilesActions } from '../views/project/ProjectPanelActions';

export class ProjectUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ISidePanelService private readonly _sidePanelService: ISidePanelService,
    @IProjectContextService private readonly _projectContext: IProjectContextService,
    @IProjectPanelService private readonly _panelService: IProjectPanelService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManager: IMenuManagerService,
    @IShortcutService private readonly _shortcutService: IShortcutService
  ) {
    super();
    this._initPanels();
    this._initCommands();
    this._initMenus();
    this._initShortcuts();
  }

  private _initPanels(): void {
    // Changes first: it is the tab people open the panel for, and it matches the
    // reference layout. Both tabs render the same ProjectPanel shell.
    this.disposeWithMe(
      this._sidePanelService.registerPanel({
        id: PROJECT_GIT_PANEL_ID,
        icon: 'diff',
        titleKey: 'project-ui.changes.title',
        component: connectInjector(ProjectChangesPanel, this._injector),
        actions: connectInjector(ChangesActions, this._injector),
        order: 10,
        available$: this._projectContext.activeContext$.pipe(
          map((c) => c?.isGitRepository ?? false)
        ),
      })
    );

    this.disposeWithMe(
      this._sidePanelService.registerPanel({
        id: PROJECT_EXPLORER_PANEL_ID,
        icon: 'folder',
        titleKey: 'project-ui.explorer.title',
        component: connectInjector(ProjectFilesPanel, this._injector),
        actions: connectInjector(FilesActions, this._injector),
        order: 20,
      })
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(ToggleExplorerPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(ToggleGitPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(FocusExplorerFilterCommand));
    this.disposeWithMe(this._commandService.registerCommand(CheckoutBranchCommand));
  }

  private _initMenus(): void {
    const panelService = this._panelService;
    const schema: MenuSchemaType = {
      [BRANCH_MENU]: {
        [CheckoutBranchCommand.id]: {
          order: 0,
          menuItemFactory: () => BranchSelectorFactory(panelService),
        },
      },
    };
    this.disposeWithMe(this._menuManager.mergeMenu(schema));
  }

  private _initShortcuts(): void {
    // ⌘⌥E / ⌘⌥G — panel toggles (doc §9.2)
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: ToggleExplorerPanelCommand.id,
      description: 'project-ui.shortcuts.toggle-explorer',
      binding: KeyCode.E | MetaKeys.CTRL_COMMAND | MetaKeys.ALT,
    }));
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: ToggleGitPanelCommand.id,
      description: 'project-ui.shortcuts.toggle-git',
      binding: KeyCode.G | MetaKeys.CTRL_COMMAND | MetaKeys.ALT,
    }));
    // ⌘F — focus filter when explorer is focused (priority over terminal search).
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: FocusExplorerFilterCommand.id,
      description: 'project-ui.shortcuts.filter-explorer',
      binding: KeyCode.F | MetaKeys.CTRL_COMMAND,
      priority: 30,
      preconditions: (ctx) => ctx.getContextValue(EXPLORER_FOCUSED_CONTEXT),
    }));
  }
}

function BranchSelectorFactory(panelService: IProjectPanelService): IMenuSelectorItem {
  return {
    id: CheckoutBranchCommand.id,
    type: MenuItemType.SELECTOR,
    title: 'project-ui.changes.switch-branch',
    // Local branches first: remotes are the long tail and only matter when the
    // branch has not been checked out yet.
    selections: panelService.branches$.pipe(
      map((branches) =>
        [...branches]
          .sort((a, b) => Number(a.remote) - Number(b.remote) || a.name.localeCompare(b.name))
          .map((branch) => ({
            value: branch.name,
            label: branch.name,
            params: { branch: branch.name, remote: branch.remote },
          }))
      )
    ),
    value$: combineLatest([panelService.branch$, panelService.branches$]).pipe(
      map(([info, branches]) => branches.find((b) => b.current)?.name ?? info?.name ?? '')
    ),
    selectionsCommandId: CheckoutBranchCommand.id,
  };
}
