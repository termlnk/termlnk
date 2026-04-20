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

import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

/** Common interactive hover/focus/highlight states for all dropdown menu items */
const ITEM_INTERACTIVE_STYLES = `
  tm:data-[highlighted]:bg-one-bg tm:data-[highlighted]:text-white
  tm:hover:bg-one-bg tm:hover:text-white
  tm:focus:bg-one-bg tm:focus:text-white
`;

/** Common SVG icon sizing and color styles for dropdown menu items */
const ITEM_SVG_STYLES = `
  tm:[&_svg:not([class*='size-'])]:size-4 tm:[&_svg:not([class*='text-'])]:text-white/80
  tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
`;

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          `
            tm:z-50 tm:max-h-(--radix-dropdown-menu-content-available-height) tm:min-w-32
            tm:origin-(--radix-dropdown-menu-content-transform-origin) tm:overflow-x-hidden tm:overflow-y-auto
            tm:rounded-md tm:border tm:border-line tm:bg-black tm:p-1 tm:text-white tm:shadow-xs
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
            tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
            tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0 tm:data-[state=open]:zoom-in-95
          `,
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm
          tm:text-white tm:outline-hidden tm:select-none
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:data-inset:pl-8
          tm:data-[variant=destructive]:text-red
          tm:data-[variant=destructive]:hover:text-red
          tm:data-[variant=destructive]:focus:text-red
          tm:data-[variant=destructive]:[&_svg]:text-red!
          ${ITEM_INTERACTIVE_STYLES}
          ${ITEM_SVG_STYLES}
        `,
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8
          tm:text-sm tm:text-white tm:outline-hidden tm:select-none
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          ${ITEM_INTERACTIVE_STYLES}
          ${ITEM_SVG_STYLES}
        `,
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="tm:pointer-events-none tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="tm:size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8
          tm:text-sm tm:text-white tm:outline-hidden tm:select-none
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          ${ITEM_INTERACTIVE_STYLES}
          ${ITEM_SVG_STYLES}
        `,
        className
      )}
      {...props}
    >
      <span
        className="tm:pointer-events-none tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="tm:size-2 tm:fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        `
          tm:px-2 tm:py-1.5 tm:text-sm tm:font-medium tm:text-white
          tm:data-inset:pl-8
        `,
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('tm:-mx-1 tm:my-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'tm:ml-auto tm:text-xs tm:tracking-widest tm:text-grey-fg',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        `
          tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm tm:text-white
          tm:outline-hidden tm:select-none
          tm:data-inset:pl-8
          tm:data-[state=open]:bg-one-bg tm:data-[state=open]:text-white
          ${ITEM_INTERACTIVE_STYLES}
          ${ITEM_SVG_STYLES}
        `,
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="tm:ml-auto tm:size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        `
          tm:z-50 tm:min-w-32 tm:origin-(--radix-dropdown-menu-content-transform-origin) tm:overflow-hidden
          tm:rounded-md tm:border tm:border-line tm:bg-black tm:p-1 tm:text-white tm:shadow-xs
          tm:data-[side=bottom]:slide-in-from-top-2
          tm:data-[side=left]:slide-in-from-right-2
          tm:data-[side=right]:slide-in-from-left-2
          tm:data-[side=top]:slide-in-from-bottom-2
          tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
          tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0 tm:data-[state=open]:zoom-in-95
        `,
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
