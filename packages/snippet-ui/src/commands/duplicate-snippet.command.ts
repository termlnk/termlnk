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
import { resolveSnippetId } from './run-snippet.command';

export const DuplicateSnippetCommand: ICommand<ISnippetCommandParams> = {
  id: 'snippet-ui.command.duplicate-snippet',
  handler: async (accessor: IAccessor, params?: ISnippetCommandParams): Promise<boolean> => {
    const snippetId = resolveSnippetId(accessor, params);
    if (!snippetId) {
      return false;
    }

    const snippetService = accessor.get(ISnippetService);
    const snippet = await snippetService.getById(snippetId);
    if (!snippet) {
      return false;
    }

    await snippetService.create({
      label: `${snippet.label} (copy)`,
      content: snippet.content,
      description: snippet.description,
      pid: snippet.pid,
      targetHostIds: snippet.targetHostIds,
      sort: snippet.sort,
      favorite: false,
    });
    return true;
  },
};
