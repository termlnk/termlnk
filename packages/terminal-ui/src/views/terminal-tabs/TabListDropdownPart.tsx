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

import type { Nullable } from '@termlnk/core';
import type { ITerminalSession } from '../../services/terminal/terminal-ui.service';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, useDependency, useObservable } from '@termlnk/design';
import { TerminalIcon } from 'lucide-react';
import { useCallback } from 'react';
import { ITabListDropdownService } from '../../services/tab-list-dropdown/tab-list-dropdown.service';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';

export function TabListDropdownPart() {
  const dropdownService = useDependency(ITabListDropdownService);
  const terminalUIService = useDependency(ITerminalUIService);

  const open = useObservable(dropdownService.open$, false);
  const sessions = useObservable<ITerminalSession[]>(terminalUIService.sessions$, []);
  const activeSessionId = useObservable<Nullable<string>>(terminalUIService.activeSessionId$);

  const handleSelect = useCallback((sessionId: string) => {
    terminalUIService.setActiveSession(sessionId);
    dropdownService.close();
  }, [terminalUIService, dropdownService]);

  const handleOpenChange = useCallback((value: boolean) => {
    if (!value) {
      dropdownService.close();
    }
  }, [dropdownService]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Tab List"
      description="Search and switch between open tabs"
      showCloseButton={false}
    >
      <Command>
        <CommandInput placeholder="Search tabs..." />
        <CommandList>
          <CommandEmpty>No tabs found.</CommandEmpty>
          <CommandGroup heading="Tabs">
            {sessions.map((session) => (
              <CommandItem
                key={session.id}
                value={session.id}
                onSelect={() => handleSelect(session.id)}
              >
                <TerminalIcon size={14} strokeWidth={1.5} className="tm:shrink-0" />
                <span className="tm:flex-1 tm:truncate">{session.title || session.hostName}</span>
                {session.id === activeSessionId && (
                  <div className="tm:inline-block tm:size-1.5 tm:shrink-0 tm:rounded-full tm:bg-blue" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
