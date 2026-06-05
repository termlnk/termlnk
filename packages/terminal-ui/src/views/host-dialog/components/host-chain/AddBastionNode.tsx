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

import type { IFlatHostInfo } from './use-flat-host-list';
import { LocaleService } from '@termlnk/core';
import { cn, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger, useDependency } from '@termlnk/design';
import { PlusIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { TimelineNode } from './TimelineNode';

export interface IAddBastionNodeProps {
  availableHosts: IFlatHostInfo[];
  loaded: boolean;
  onAdd: (hostId: string) => void;
}

export function AddBastionNode(props: IAddBastionNodeProps) {
  const { availableHosts, loaded, onAdd } = props;
  const localeService = useDependency(LocaleService);
  const [open, setOpen] = useState(false);

  const disabled = !loaded || availableHosts.length === 0;

  const placeholder = !loaded
    ? localeService.t('terminal-ui.host-dialog.hostChain.loading')
    : availableHosts.length === 0
      ? localeService.t('terminal-ui.host-dialog.hostChain.noAvailable')
      : localeService.t('terminal-ui.host-dialog.hostChain.addPlaceholder');

  const handleSelect = useCallback((hostId: string) => {
    onAdd(hostId);
    setOpen(false);
  }, [onAdd]);

  return (
    <TimelineNode variant="add">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              `
                tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-dashed tm:border-one-bg3
                tm:bg-transparent tm:px-2 tm:py-1.5 tm:text-xs tm:text-white tm:transition-colors
                tm:hover:border-blue tm:hover:text-blue
                tm:focus-visible:border-blue tm:focus-visible:text-blue tm:focus-visible:outline-hidden
              `,
              {
                'tm:cursor-not-allowed tm:opacity-40 tm:hover:border-one-bg3 tm:hover:text-white': disabled,
                'tm:border-blue tm:text-blue': open,
              }
            )}
          >
            <PlusIcon className="tm:size-3.5" />
            <span className="tm:flex-1 tm:text-left">{placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="tm:w-(--radix-popover-trigger-width) tm:max-w-md tm:min-w-65 tm:border-line tm:bg-black tm:p-0"
        >
          <Command>
            <CommandInput
              placeholder={localeService.t('terminal-ui.host-dialog.hostChain.searchPlaceholder')}
            />
            <CommandList>
              <CommandEmpty>
                {localeService.t('terminal-ui.host-dialog.hostChain.noMatches')}
              </CommandEmpty>
              <CommandGroup>
                {availableHosts.map((host) => (
                  <CommandItem
                    key={host.id}
                    value={`${host.label} ${host.addr} ${host.port}`}
                    onSelect={() => handleSelect(host.id)}
                  >
                    <span className="tm:flex-1 tm:truncate">{host.label}</span>
                    <span className="tm:ml-2 tm:text-xs tm:text-grey-fg2">
                      {host.addr}
                      :
                      {host.port}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </TimelineNode>
  );
}
