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
import { KeyCode, MetaKeys } from '@termlnk/ui';
import { DeleteHostCommand } from '../../commands/delete-host.command';
import { HOSTS_EXPLORER_FOCUSED_CONTEXT } from '../../services/hosts-explorer/contextmenu-positions';

// macOS uses Cmd+Backspace (no physical Delete key); Windows/Linux use bare
// Delete. Skip when an editable element is focused so rename inputs keep their
// native backspace behaviour.
export const DeleteHostShortcut: IShortcutItem = {
  id: DeleteHostCommand.id,
  description: 'terminal-ui.shortcuts.delete-host',
  binding: KeyCode.DELETE,
  mac: KeyCode.BACKSPACE | MetaKeys.CTRL_COMMAND,
  preconditions: (ctx) => {
    if (!ctx.getContextValue(HOSTS_EXPLORER_FOCUSED_CONTEXT)) {
      return false;
    }
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    return tag !== 'INPUT' && tag !== 'TEXTAREA' && !active?.isContentEditable;
  },
};
