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
import type { FileAction } from '../../services/file-context/file-context.service';
import { FileContextService } from '../../services/file-context/file-context.service';

export interface IFileActionParams {
  action: FileAction;
}

/** Runs the chosen action on the current file-menu target, then clears it. */
export const FileActionCommand: ICommand<IFileActionParams> = {
  id: 'sftp-ui.command.file-action',
  handler: (accessor: IAccessor, params: IFileActionParams) => {
    const service = accessor.get(FileContextService);
    const target = service.target;
    if (!target) {
      return false;
    }
    target.actions[params.action]?.();
    service.clear();
    return true;
  },
};
