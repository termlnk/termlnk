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

import { ICommandService, Inject, Injector, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IProjectContextService } from '@termlnk/project';
import { IShortcutService, ISidePanelService, KeyCode, MetaKeys } from '@termlnk/ui';
import { map } from 'rxjs/operators';
import { FocusExplorerFilterCommand } from '../commands/focus-explorer-filter.command';
import { ToggleExplorerPanelCommand } from '../commands/toggle-explorer-panel.command';
import { ToggleGitPanelCommand } from '../commands/toggle-git-panel.command';
import {
  EXPLORER_FOCUSED_CONTEXT,
  PROJECT_EXPLORER_PANEL_ID,
  PROJECT_GIT_PANEL_ID,
} from '../common/constants';
import { ProjectExplorerPanel } from '../views/explorer/ProjectExplorerPanel';
import { GitPanel } from '../views/git/GitPanel';

export class ProjectUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ISidePanelService private readonly _sidePanelService: ISidePanelService,
    @IProjectContextService private readonly _projectContext: IProjectContextService,
    @ICommandService private readonly _commandService: ICommandService,
    @IShortcutService private readonly _shortcutService: IShortcutService
  ) {
    super();
    this._initPanels();
    this._initCommands();
    this._initShortcuts();
  }

  private _initPanels(): void {
    this.disposeWithMe(
      this._sidePanelService.registerPanel({
        id: PROJECT_EXPLORER_PANEL_ID,
        icon: 'folder',
        titleKey: 'project-ui.explorer.title',
        component: connectInjector(ProjectExplorerPanel, this._injector),
        order: 10,
      })
    );

    this.disposeWithMe(
      this._sidePanelService.registerPanel({
        id: PROJECT_GIT_PANEL_ID,
        icon: 'git',
        titleKey: 'project-ui.git.title',
        component: connectInjector(GitPanel, this._injector),
        order: 20,
        available$: this._projectContext.activeContext$.pipe(
          map((c) => c?.isGitRepository ?? false)
        ),
      })
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(ToggleExplorerPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(ToggleGitPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(FocusExplorerFilterCommand));
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
