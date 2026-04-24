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
import { IHostExplorerService } from '../services/hosts-explorer/hosts-explorer.service';

export const NewGroupCommand: ICommand = {
  id: 'terminal-ui.command.new-group',
  handler: (accessor: IAccessor) => {
    // The headless-tree instance and the inline-group input state both live
    // inside the HostExplorer view, so this command only signals the intent.
    // HostExplorer subscribes to `createGroupRequest$` and runs its own
    // parent/level derivation against the current focus.
    accessor.get(IHostExplorerService).requestCreateGroup();
    return true;
  },
};
