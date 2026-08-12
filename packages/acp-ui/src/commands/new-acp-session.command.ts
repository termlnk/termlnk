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
import { IACPSessionLauncher } from '../services/acp-session-launcher.service';

export const NewACPSessionCommand: ICommand<{ providerId: string; cwd?: string }> = {
  id: 'acp-ui.command.new-acp-session',
  handler: async (accessor: IAccessor, params) => {
    if (!params?.providerId) {
      return false;
    }
    try {
      await accessor.get(IACPSessionLauncher).launch(params.providerId, params.cwd);
      return true;
    } catch {
      // The launcher already reported it on the tab and via a notification;
      // rethrowing would only become an unhandled rejection in the menu, which
      // never awaits executeCommand.
      return false;
    }
  },
};
