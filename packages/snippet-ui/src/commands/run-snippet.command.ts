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
import { ISSHService } from '@termlnk/rpc-client';
import { ISnippetService } from '@termlnk/snippet';
import { filter, firstValueFrom, take } from 'rxjs';
import { ISnippetContextService } from '../services/snippet-context/snippet-context.service';

export interface ISnippetCommandParams {
  snippetId: string;
}

export function resolveSnippetId(accessor: IAccessor, params?: ISnippetCommandParams): string | null {
  return params?.snippetId ?? accessor.get(ISnippetContextService).target?.id ?? null;
}

export const RunSnippetCommand: ICommand<ISnippetCommandParams> = {
  id: 'snippet-ui.command.run-snippet',
  handler: async (accessor: IAccessor, params?: ISnippetCommandParams): Promise<boolean> => {
    const snippetId = resolveSnippetId(accessor, params);
    if (!snippetId) {
      return false;
    }

    const snippetService = accessor.get(ISnippetService);
    const snippet = await snippetService.getById(snippetId);
    if (!snippet?.targetHostIds?.length) {
      return false;
    }

    const sshService = accessor.get(ISSHService);

    for (const hostId of snippet.targetHostIds) {
      const sessionId = await sshService.createSession(hostId);
      await firstValueFrom(
        sshService.status$(sessionId).pipe(
          filter((status) => status === 'ready'),
          take(1),
        ),
      );
      await snippetService.run(sessionId, snippet.content);
    }

    return true;
  },
};
