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

import type { IShortcutItem } from '@termlnk/ui';
import type { ISelectTabByIndexCommandParams } from '../../commands/select-tab-by-index.command';
import type { ISplitSessionCommandParams } from '../../commands/split-session.command';
import { KeyCode, MetaKeys } from '@termlnk/ui';
import { CloseActiveTabCommand } from '../../commands/close-active-tab.command';
import { MaximizeSessionCommand } from '../../commands/maximize-session.command';
import { SelectTabByIndexCommand } from '../../commands/select-tab-by-index.command';
import { SplitSessionCommand } from '../../commands/split-session.command';

export const MaximizeSessionShortcut: IShortcutItem = {
  id: MaximizeSessionCommand.id,
  description: 'terminal-ui.shortcuts.maximize-session',
  binding: KeyCode.ENTER | MetaKeys.CTRL_COMMAND,
};

export const CloseActiveTabShortcut: IShortcutItem = {
  id: CloseActiveTabCommand.id,
  description: 'terminal-ui.shortcuts.close-active-tab',
  binding: KeyCode.W | MetaKeys.CTRL_COMMAND,
};

// Cmd/Ctrl + D splits the active pane to the right.
export const SplitRightShortcut: IShortcutItem<ISplitSessionCommandParams> = {
  id: SplitSessionCommand.id,
  description: 'terminal-ui.shortcuts.split-right',
  binding: KeyCode.D | MetaKeys.CTRL_COMMAND,
  staticParameters: { direction: 'horizontal' },
};

// Cmd/Ctrl + Shift + D splits the active pane downward.
export const SplitDownShortcut: IShortcutItem<ISplitSessionCommandParams> = {
  id: SplitSessionCommand.id,
  description: 'terminal-ui.shortcuts.split-down',
  binding: KeyCode.D | MetaKeys.CTRL_COMMAND | MetaKeys.SHIFT,
  staticParameters: { direction: 'vertical' },
};

// Cmd/Ctrl + 1..9 jumps to the matching tab (1-based key, 0-based index).
export const SelectTabByIndexShortcuts: IShortcutItem<ISelectTabByIndexCommandParams>[] = Array.from(
  { length: 9 },
  (_, index) => ({
    id: SelectTabByIndexCommand.id,
    description: 'terminal-ui.shortcuts.select-tab',
    binding: (KeyCode.Digit1 + index) | MetaKeys.CTRL_COMMAND,
    staticParameters: { index },
  })
);
