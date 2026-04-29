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
import { IAIAgentClientService } from '@termlnk/rpc-client';

export interface IEditUserMessageParams {
  messageId: string;
  content: string;
}

export const EditUserMessageCommand: ICommand<IEditUserMessageParams, boolean> = {
  id: 'agent-ui.command.edit-user-message',
  handler: async (accessor: IAccessor, params?: IEditUserMessageParams): Promise<boolean> => {
    if (!params?.messageId || !params.content) {
      return false;
    }
    const agentClient = accessor.get(IAIAgentClientService);
    await agentClient.editUserMessage(params.messageId, params.content);
    return true;
  },
};
