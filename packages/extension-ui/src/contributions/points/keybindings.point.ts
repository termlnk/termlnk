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

import type { IContributedKeybinding, IContributionPoint, IExtensionDescription } from '@termlnk/extension';
import type { z } from 'zod';
import { DisposableCollection, ILogService, toDisposable } from '@termlnk/core';
import { contributedKeybindingsSchema } from '@termlnk/extension';
import { IShortcutService, KeyCode, MetaKeys } from '@termlnk/ui';

/**
 * `keybindings` contribution point.
 *
 * Parses VS Code–style shortcut strings ("Ctrl+Shift+H", "Cmd+Alt+L") into
 * the numeric binding form used by `IShortcutService`, honoring per-platform
 * overrides (`mac`/`win`/`linux`). Invalid bindings are logged and skipped
 * rather than failing the entire contribution.
 */
export class KeybindingsPoint implements IContributionPoint<IContributedKeybinding[]> {
  readonly name = 'keybindings';
  readonly schema: z.ZodType<IContributedKeybinding[]> = contributedKeybindingsSchema;

  constructor(
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @ILogService private readonly _logService: ILogService
  ) {}

  apply(description: IExtensionDescription, bindings: IContributedKeybinding[]): ReturnType<IContributionPoint<IContributedKeybinding[]>['apply']> {
    const collection = new DisposableCollection();

    for (const kb of bindings) {
      const binding = parseKeybinding(kb.key);
      if (binding === null) {
        this._logService.warn(
          '[KeybindingsPoint]',
          `Invalid keybinding "${kb.key}" in ${description.id}`
        );
        continue;
      }

      collection.add(this._shortcutService.registerShortcut({
        id: kb.command,
        binding,
        mac: kb.mac ? parseKeybinding(kb.mac) ?? undefined : undefined,
        win: kb.win ? parseKeybinding(kb.win) ?? undefined : undefined,
        linux: kb.linux ? parseKeybinding(kb.linux) ?? undefined : undefined,
      }));
    }

    return toDisposable(() => collection.dispose());
  }
}

const NAMED_KEYS: Readonly<Record<string, KeyCode>> = Object.freeze({
  enter: KeyCode.ENTER,
  return: KeyCode.ENTER,
  space: KeyCode.SPACE,
  spacebar: KeyCode.SPACE,
  esc: KeyCode.ESC,
  escape: KeyCode.ESC,
  tab: KeyCode.TAB,
  backspace: KeyCode.BACKSPACE,
  delete: KeyCode.DELETE,
  del: KeyCode.DELETE,
  insert: KeyCode.INSERT,
  left: KeyCode.ARROW_LEFT,
  right: KeyCode.ARROW_RIGHT,
  up: KeyCode.ARROW_UP,
  down: KeyCode.ARROW_DOWN,
  f1: KeyCode.F1,
  f2: KeyCode.F2,
  f3: KeyCode.F3,
  f4: KeyCode.F4,
  f5: KeyCode.F5,
  f6: KeyCode.F6,
  f7: KeyCode.F7,
  f8: KeyCode.F8,
  f9: KeyCode.F9,
  f10: KeyCode.F10,
  f11: KeyCode.F11,
  f12: KeyCode.F12,
  minus: KeyCode.MINUS,
  '-': KeyCode.MINUS,
  equal: KeyCode.EQUAL,
  '=': KeyCode.EQUAL,
  period: KeyCode.PERIOD,
  '.': KeyCode.PERIOD,
  comma: KeyCode.COMMA,
  ',': KeyCode.COMMA,
});

function parseKeybinding(input: string): number | null {
  const parts = input.split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) {
    return null;
  }

  let modifiers = 0;
  let keyCode: number | null = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'cmd' || lower === 'control' || lower === 'command' || lower === 'meta') {
      modifiers |= MetaKeys.CTRL_COMMAND;
      continue;
    }
    if (lower === 'shift') {
      modifiers |= MetaKeys.SHIFT;
      continue;
    }
    if (lower === 'alt' || lower === 'option' || lower === 'opt') {
      modifiers |= MetaKeys.ALT;
      continue;
    }
    if (lower === 'macctrl') {
      modifiers |= MetaKeys.MAC_CTRL;
      continue;
    }
    if (NAMED_KEYS[lower] !== undefined) {
      keyCode = NAMED_KEYS[lower];
      continue;
    }
    if (lower.length === 1) {
      const char = lower.charCodeAt(0);
      if (char >= 97 && char <= 122) {
        keyCode = (char - 97) + KeyCode.A;
        continue;
      }
      if (char >= 48 && char <= 57) {
        keyCode = (char - 48) + KeyCode.Digit0;
        continue;
      }
    }
  }

  if (keyCode === null) {
    return null;
  }
  return keyCode | modifiers;
}
