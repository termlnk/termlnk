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
import { ISidePanelService } from '@termlnk/ui';
import { AGENT_UI_CHAT_PANEL_ID } from '../controllers/chat-panel.controller';

export const ToggleAIPanelCommand: ICommand = {
  id: 'agent-ui.command.toggle-ai-panel',
  handler: (accessor: IAccessor): boolean => {
    accessor.get(ISidePanelService).togglePanel(AGENT_UI_CHAT_PANEL_ID);
    return true;
  },
};
