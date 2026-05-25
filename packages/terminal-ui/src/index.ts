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

import './global.css';

export { CloseActiveTabCommand } from './commands/close-active-tab.command';
export { ConnectHostCommand } from './commands/connect-host.command';
export { MaximizeSessionCommand } from './commands/maximize-session.command';
export { OpenLocalTerminalCommand } from './commands/open-local-terminal.command';
export { TERMINAL_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { ITerminalUIConfig } from './controllers/config.schema';
export { hostsMenuFactory } from './controllers/menu/host.menu';
export { TerminalUIController } from './controllers/terminal-ui.controller';
export { WorkspaceController } from './controllers/workspace/workspace.controller';
export type { DropSide, IMagnifyState, ISingleSessionTabItem, ITabDisplayItem, ITabItem, IWorkspace, IWorkspaceLayoutBranch, IWorkspaceLayoutLeaf, IWorkspaceLayoutNode, IWorkspaceTabItem, WorkspaceLayoutDirection } from './models/workspace.model';
export { TERMINAL_UI_PLUGIN_NAME, TerminalUIPlugin } from './plugin';
export { ILastCwdService, LastCwdService } from './services/local-terminal/last-cwd.service';
export { CommandTracker } from './services/shell-integration/command-tracker';
export { ITerminalInputService, TerminalInputService } from './services/terminal-input/terminal-input.service';
export { TerminalKeyIntent } from './services/terminal-input/terminal-input.service';
export type { ITerminalInputEvent } from './services/terminal-input/terminal-input.service';
export { ITerminalPersistenceService, TerminalPersistenceService } from './services/terminal/terminal-persistence.service';
export type { IPersistedTerminalSession, IPersistedTerminalState, IPersistedTerminalStateV2, IPersistedWorkspace } from './services/terminal/terminal-persistence.service';
export { ITerminalUIService, TerminalUIService } from './services/terminal/terminal-ui.service';
export type { AddSessionParams, ITerminalSession, TerminalSessionStatus } from './services/terminal/terminal-ui.service';
export { ITerminalViewRegistry, TerminalViewRegistry } from './services/terminal/terminal-view-registry.service';
export type { ITabAdornmentProps, ITerminalViewProps } from './services/terminal/terminal-view-registry.service';
export { IWorkspaceService, WorkspaceService } from './services/workspace/workspace.service';
export { detectShellType, escapePathForShell, escapePathsForShell } from './utils/shell-path-escape';
export type { ShellType } from './utils/shell-path-escape';
export { useGlobalTerminalAppearance, useXterm, XTERM_PROGRESS_STATE } from './views/hooks';
export type { IGlobalTerminalAppearance, ISerializeResult, IUseXtermOptions, IXtermProgressState } from './views/hooks';
export { TerminalContainer } from './views/terminal-container/TerminalContainer';
export { TerminalTabs } from './views/terminal-tabs/TerminalTabs';
export type { ITerminalTabsProps } from './views/terminal-tabs/TerminalTabs';
export { TerminalView } from './views/terminal/Terminal';
export { TerminalDropOverlay } from './views/terminal/TerminalDropOverlay';
export type { ITerminalDropOverlayProps } from './views/terminal/TerminalDropOverlay';
export { TerminalProgressOverlay } from './views/terminal/TerminalProgressOverlay';
export type { ITerminalProgressOverlayProps } from './views/terminal/TerminalProgressOverlay';
export { TerminalSearch } from './views/terminal/TerminalSearch';
export type { ITerminalSearchProps } from './views/terminal/TerminalSearch';
export { useTerminalDrop } from './views/terminal/use-terminal-drop';
export type { IUseTerminalDropOptions, IUseTerminalDropResult } from './views/terminal/use-terminal-drop';
export { useTerminalSearch } from './views/terminal/use-terminal-search';
export type { IUseTerminalSearchOptions, IUseTerminalSearchResult } from './views/terminal/use-terminal-search';
export { useShellIntegration } from './views/use-shell-integration';
export type { IUseShellIntegrationOptions } from './views/use-shell-integration';
