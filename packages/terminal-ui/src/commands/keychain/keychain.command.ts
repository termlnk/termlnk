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

import type { IAccessor, ICommand } from '@termlnk/core';
import { KeychainDialogService } from '../../services/keychain/keychain-dialog.service';

export const GenerateKeyCommand: ICommand = {
  id: 'terminal-ui.command.keychain.generate-key',
  handler: (accessor: IAccessor) => {
    accessor.get(KeychainDialogService).openGenerateKey();
    return true;
  },
};

export const NewKeyCommand: ICommand = {
  id: 'terminal-ui.command.keychain.new-key',
  handler: (accessor: IAccessor) => {
    accessor.get(KeychainDialogService).openNewKey();
    return true;
  },
};

export const NewIdentityCommand: ICommand = {
  id: 'terminal-ui.command.keychain.new-identity',
  handler: (accessor: IAccessor) => {
    accessor.get(KeychainDialogService).openNewIdentity();
    return true;
  },
};
