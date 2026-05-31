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
import { IAuthService } from '@termlnk/auth';
import { Quantity } from '@termlnk/core';
import { ToggleAccountDialogCommand } from './toggle-account-dialog.command';

// Programmatic logout. Login is intentionally omitted: zero-knowledge auth requires the
// password as input, so there is no parameter-less login command we could expose.
// Returns false when IAuthService is unbound (cloud not configured).
export const LogoutCommand: ICommand = {
  id: 'auth-ui.command.logout',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const auth = accessor.get(IAuthService, Quantity.OPTIONAL);
    if (!auth) {
      return false;
    }
    await auth.logout();
    return true;
  },
};

export const AUTH_COMMANDS: readonly ICommand[] = [
  LogoutCommand,
  ToggleAccountDialogCommand,
] as const;
