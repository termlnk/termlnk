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

import { Command as CommandPrimitive } from 'cmdk';
import { CheckIcon, SearchIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../common/cn';
import { DialogContent, DialogDescription, DialogHeader, DialogPrimitive, DialogTitle } from '../dialog';
import { InputGroup, InputGroupAddon } from '../input';

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'tm:flex tm:size-full tm:flex-col tm:overflow-hidden tm:rounded-xl! tm:bg-black tm:p-1 tm:text-white',
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command...',
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive {...props}>
      <DialogContent
        className={cn(
          'tm:top-1/3 tm:translate-y-0 tm:overflow-hidden tm:rounded-xl! tm:p-0',
          className
        )}
        closable={showCloseButton}
      >
        <DialogHeader className="tm:sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogPrimitive>
  );
}

function CommandInput({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="tm:p-1 tm:pb-0">
      <InputGroup
        className="
          tm:h-8! tm:rounded-lg! tm:border-line/30 tm:bg-line/30 tm:shadow-none!
          tm:*:data-[slot=input-group-addon]:pl-2!
        "
      >
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            `
              tm:w-full tm:text-sm tm:outline-hidden
              tm:disabled:cursor-not-allowed tm:disabled:opacity-50
            `,
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="tm:size-4 tm:shrink-0 tm:opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'tm:max-h-[300px] tm:scroll-py-1 tm:overflow-x-hidden tm:overflow-y-auto tm:outline-none',
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('tm:py-6 tm:text-center tm:text-sm', className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(`
        tm:overflow-hidden tm:p-1 tm:text-white
        tm:**:[[cmdk-group-heading]]:px-2 tm:**:[[cmdk-group-heading]]:py-1.5 tm:**:[[cmdk-group-heading]]:text-xs
        tm:**:[[cmdk-group-heading]]:font-medium tm:**:[[cmdk-group-heading]]:text-light-grey
      `, className)}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('tm:-mx-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        `
          tm:group/command-item
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-sm tm:px-2 tm:py-1.5 tm:text-sm
          tm:outline-hidden tm:select-none
          tm:in-data-[slot=dialog-content]:rounded-lg!
          tm:data-[disabled=true]:pointer-events-none tm:data-[disabled=true]:opacity-50
          tm:data-[selected=true]:bg-one-bg tm:data-[selected=true]:text-white
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
          tm:data-[selected=true]:*:[svg]:text-white
        `,
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon
        className="
          tm:ml-auto tm:opacity-0
          tm:group-has-data-[slot=command-shortcut]/command-item:hidden
          tm:group-data-[selected=true]/command-item:opacity-100
        "
      />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(`
        tm:ml-auto tm:text-xs tm:tracking-widest tm:text-light-grey
        tm:group-data-[selected=true]/command-item:text-white
      `, className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
