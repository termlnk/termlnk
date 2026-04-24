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

export const HOSTS_EXPLORER_HOST_ITEM_MENU = 'terminal-ui.context-menu.hosts-explorer.host-item';
export const HOSTS_EXPLORER_FOLDER_ITEM_MENU = 'terminal-ui.context-menu.hosts-explorer.folder-item';
export const HOSTS_EXPLORER_BLANK_MENU = 'terminal-ui.context-menu.hosts-explorer.blank';

/**
 * Context key gating shortcuts that should only fire while the explorer has
 * keyboard focus (e.g. Delete / Cmd+Backspace for removing the focused host).
 * The view sets this to true on focus and clears it on blur.
 */
export const HOSTS_EXPLORER_FOCUSED_CONTEXT = 'hostsExplorer.focused';
