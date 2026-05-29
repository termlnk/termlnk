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

import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'xs' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        `
          tm:flex tm:w-fit tm:items-center tm:justify-between tm:gap-2 tm:rounded-md tm:border tm:border-line
          tm:bg-black tm:p-3 tm:text-sm tm:whitespace-nowrap tm:text-white tm:shadow-xs tm:outline-hidden
          tm:transition-[color,box-shadow]
          tm:hover:border-blue tm:hover:bg-black
          tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
          tm:data-placeholder:text-grey-fg
          tm:data-[size=default]:h-9
          tm:data-[size=sm]:h-8
          tm:data-[size=xs]:h-7
          tm:*:data-[slot=select-value]:line-clamp-1 tm:*:data-[slot=select-value]:flex
          tm:*:data-[slot=select-value]:items-center tm:*:data-[slot=select-value]:gap-2
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
          tm:[&_svg:not([class*='text-'])]:text-grey-fg
        `,
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="tm:size-4 tm:opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'item-aligned',
  align = 'center',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          `
            tm:relative tm:z-50 tm:max-h-(--radix-select-content-available-height) tm:min-w-32
            tm:origin-(--radix-select-content-transform-origin) tm:overflow-x-hidden tm:overflow-y-auto tm:rounded-md
            tm:border tm:border-line tm:bg-black tm:text-white tm:shadow-md
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
            tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
            tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0 tm:data-[state=open]:zoom-in-95
          `,
          position === 'popper' &&
          `
            tm:data-[side=bottom]:translate-y-1
            tm:data-[side=left]:-translate-x-1
            tm:data-[side=right]:translate-x-1
            tm:data-[side=top]:-translate-y-1
          `,
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'tm:p-1',
            position === 'popper' &&
            'tm:h-(--radix-select-trigger-height) tm:w-full tm:min-w-(--radix-select-trigger-width) tm:scroll-my-1'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('tm:px-2 tm:py-1.5 tm:text-xs tm:text-white', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        `
          tm:relative tm:flex tm:w-full tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-8
          tm:pl-2 tm:text-sm tm:outline-hidden tm:select-none
          tm:focus:bg-one-bg2 tm:focus:text-white
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:data-highlighted:bg-one-bg2 tm:data-highlighted:text-white
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
          tm:[&_svg:not([class*='text-'])]:text-grey-fg
          tm:[&>span:last-child]:flex tm:[&>span:last-child]:items-center tm:[&>span:last-child]:gap-2
        `,
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="tm:absolute tm:right-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center tm:text-white"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="tm:size-4 tm:text-white" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('tm:pointer-events-none tm:-mx-1 tm:my-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        'tm:flex tm:cursor-default tm:items-center tm:justify-center tm:py-1',
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="tm:size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        'tm:flex tm:cursor-default tm:items-center tm:justify-center tm:py-1',
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="tm:size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
