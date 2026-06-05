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
import { InputGroup, InputGroupAddon } from '../input';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

function SearchSelect({
  children,
  ...props
}: React.ComponentProps<typeof Popover>) {
  return <Popover {...props}>{children}</Popover>;
}

function SearchSelectTrigger({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger data-slot="search-select-trigger" {...props} />;
}

function SearchSelectContent({
  className,
  children,
  filter,
  loop = true,
  ...props
}: React.ComponentProps<typeof PopoverContent> & {
  filter?: React.ComponentProps<typeof CommandPrimitive>['filter'];
  loop?: boolean;
}) {
  return (
    <PopoverContent
      className={cn('tm:w-auto tm:bg-black tm:p-0', className)}
      {...props}
    >
      <CommandPrimitive
        data-slot="search-select"
        loop={loop}
        filter={filter}
        className="tm:flex tm:size-full tm:flex-col tm:overflow-hidden tm:text-white"
      >
        {children}
      </CommandPrimitive>
    </PopoverContent>
  );
}

function SearchSelectInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="search-select-input-wrapper" className="tm:p-1 tm:pb-0">
      <InputGroup
        className="
          tm:h-8! tm:rounded-lg! tm:border-line/30 tm:bg-line/30 tm:shadow-none!
          tm:*:data-[slot=input-group-addon]:pl-2!
        "
      >
        <CommandPrimitive.Input
          data-slot="search-select-input"
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

function SearchSelectList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="search-select-list"
      className={cn(
        'tm:max-h-[300px] tm:scroll-py-1 tm:overflow-x-hidden tm:overflow-y-auto tm:outline-none',
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// SearchSelectEmpty
// ---------------------------------------------------------------------------

function SearchSelectEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="search-select-empty"
      className={cn('tm:py-6 tm:text-center tm:text-sm tm:text-grey-fg', className)}
      {...props}
    />
  );
}

function SearchSelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="search-select-group"
      className={cn(`
        tm:overflow-hidden tm:p-1 tm:text-white
        tm:**:[[cmdk-group-heading]]:px-2 tm:**:[[cmdk-group-heading]]:py-1.5 tm:**:[[cmdk-group-heading]]:text-xs
        tm:**:[[cmdk-group-heading]]:font-medium tm:**:[[cmdk-group-heading]]:text-grey-fg
      `, className)}
      {...props}
    />
  );
}

function SearchSelectItem({
  selected = false,
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
  selected?: boolean;
}) {
  return (
    <CommandPrimitive.Item
      data-slot="search-select-item"
      data-selected-value={selected || undefined}
      className={cn(
        `
          tm:relative tm:flex tm:items-center tm:gap-2 tm:rounded-sm tm:px-2 tm:py-1.5 tm:text-sm tm:outline-hidden
          tm:transition-colors tm:duration-150 tm:select-none
          tm:hover:bg-blue/20
          tm:data-[disabled=true]:pointer-events-none tm:data-[disabled=true]:opacity-50
        `,
        className
      )}
      {...props}
    >
      <span className="tm:flex tm:w-4 tm:shrink-0 tm:items-center tm:justify-center">
        {selected && <CheckIcon className="tm:size-3.5" />}
      </span>
      {children}
    </CommandPrimitive.Item>
  );
}

function SearchSelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="search-select-separator"
      className={cn('tm:-mx-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

export {
  SearchSelect,
  SearchSelectContent,
  SearchSelectEmpty,
  SearchSelectGroup,
  SearchSelectInput,
  SearchSelectItem,
  SearchSelectList,
  SearchSelectSeparator,
  SearchSelectTrigger,
};
