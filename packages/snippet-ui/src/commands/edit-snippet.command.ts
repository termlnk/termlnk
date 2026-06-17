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
import type { ISnippetCommandParams } from './run-snippet.command';
import { ISnippetService } from '@termlnk/snippet';
import { ISnippetDialogService } from '../services/snippet-dialog.service';
import { resolveSnippetId } from './run-snippet.command';

export const EditSnippetCommand: ICommand<ISnippetCommandParams> = {
  id: 'snippet-ui.command.edit-snippet',
  handler: (accessor: IAccessor, params?: ISnippetCommandParams): boolean => {
    const snippetId = resolveSnippetId(accessor, params);
    if (!snippetId) {
      return false;
    }
    accessor.get(ISnippetDialogService).openEdit(snippetId);
    return true;
  },
};

export const DeleteSnippetCommand: ICommand<ISnippetCommandParams> = {
  id: 'snippet-ui.command.delete-snippet',
  handler: async (accessor: IAccessor, params?: ISnippetCommandParams): Promise<boolean> => {
    const snippetId = resolveSnippetId(accessor, params);
    if (!snippetId) {
      return false;
    }
    await accessor.get(ISnippetService).delete(snippetId);
    return true;
  },
};
