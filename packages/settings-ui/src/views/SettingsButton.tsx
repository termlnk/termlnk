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

import { ICommandService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { Settings } from 'lucide-react';
import { ToggleSettingsCommand } from '../commands/toggle-settings.command';

export function SettingsButton() {
  const commandService = useDependency(ICommandService);

  const openSettingsDialog = () => commandService.executeCommand(ToggleSettingsCommand.id);

  return (
    <TooltipWrapper
      side="right"
      commandId={ToggleSettingsCommand.id}
      labelKey="settings-ui.title"
    >
      <div
        className={`
          tm:grid tm:h-[2.8rem] tm:w-full tm:grid-cols-[2px_1fr_2px] tm:items-center tm:overflow-hidden tm:text-center
          tm:hover:text-white
        `}
        onClick={openSettingsDialog}
      >
        <span aria-hidden />
        <span className="tm:flex tm:items-center tm:justify-center">
          <Settings size="1.2rem" />
        </span>
        <span aria-hidden />
      </div>
    </TooltipWrapper>
  );
}
