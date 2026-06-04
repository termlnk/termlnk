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

import type { IMenuButtonItem } from '@termlnk/ui';
import { MenuItemType } from '@termlnk/ui';
import { GenerateKeyCommand, NewIdentityCommand, NewKeyCommand } from '../../commands/keychain/keychain.command';

/** Anchored dropdown opened by the keychain header "+" button. */
export const KEYCHAIN_ADD_MENU = 'terminal-ui.context-menu.keychain.add';

export function GenerateKeyMenuItemFactory(): IMenuButtonItem {
  return {
    id: GenerateKeyCommand.id,
    commandId: GenerateKeyCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.keychain.action.generate',
  };
}

export function NewKeyMenuItemFactory(): IMenuButtonItem {
  return {
    id: NewKeyCommand.id,
    commandId: NewKeyCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.keychain.action.newKey',
  };
}

export function NewIdentityMenuItemFactory(): IMenuButtonItem {
  return {
    id: NewIdentityCommand.id,
    commandId: NewIdentityCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.keychain.action.newIdentity',
  };
}
