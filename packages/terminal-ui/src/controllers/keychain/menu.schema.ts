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

import type { MenuSchemaType } from '@termlnk/ui';
import { MenuPosition } from '@termlnk/ui';
import { GenerateKeyCommand, NewIdentityCommand, NewKeyCommand } from '../../commands/keychain/keychain.command';
import { ToggleKeychainPanelCommand } from '../../commands/toggle-keychain-panel.command';
import { GenerateKeyMenuItemFactory, KEYCHAIN_ADD_MENU, NewIdentityMenuItemFactory, NewKeyMenuItemFactory } from './add-menu';
import { keychainMenuFactory } from './keychain.menu';

export const menuSchema: MenuSchemaType = {
  [MenuPosition.SIDE_TAB_BAR]: {
    [ToggleKeychainPanelCommand.id]: {
      order: 6,
      menuItemFactory: keychainMenuFactory,
    },
  },
  [KEYCHAIN_ADD_MENU]: {
    [GenerateKeyCommand.id]: { order: 0, menuItemFactory: GenerateKeyMenuItemFactory },
    [NewKeyCommand.id]: { order: 1, menuItemFactory: NewKeyMenuItemFactory },
    [NewIdentityCommand.id]: { order: 2, menuItemFactory: NewIdentityMenuItemFactory },
  },
};
