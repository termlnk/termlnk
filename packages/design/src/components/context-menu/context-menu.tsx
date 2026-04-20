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
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  );
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  );
}

function ContextMenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        `
          tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm tm:outline-hidden
          tm:select-none
          tm:focus:bg-one-bg3 tm:focus:text-light-grey
          tm:data-inset:pl-8
          tm:data-[state=open]:bg-one-bg2 tm:data-[state=open]:text-light-grey
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
          tm:[&_svg:not([class*='text-'])]:text-grey-fg
        `,
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="tm:ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        `
          tm:z-50 tm:min-w-32 tm:origin-(--radix-context-menu-content-transform-origin) tm:overflow-hidden tm:rounded-md
          tm:border tm:bg-one-bg tm:p-1 tm:text-light-grey tm:shadow-lg
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

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          `
            tm:z-50 tm:max-h-(--radix-context-menu-content-available-height) tm:min-w-32
            tm:origin-(--radix-context-menu-content-transform-origin) tm:overflow-x-hidden tm:overflow-y-auto
            tm:rounded-md tm:border tm:bg-one-bg tm:p-1 tm:text-light-grey tm:shadow-md
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
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm
          tm:outline-hidden tm:select-none
          tm:focus:bg-one-bg3 tm:focus:text-light-grey
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:data-inset:pl-8
          tm:data-[variant=destructive]:text-red
          tm:data-[variant=destructive]:focus:bg-red/15 tm:data-[variant=destructive]:focus:text-red
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:data-[variant=destructive]:[&_svg]:text-red!
          tm:[&_svg:not([class*='size-'])]:size-4
          tm:[&_svg:not([class*='text-'])]:text-grey-fg
        `,
        className
      )}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8
          tm:text-sm tm:outline-hidden tm:select-none
          tm:focus:bg-one-bg3 tm:focus:text-light-grey
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
        `,
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="tm:pointer-events-none tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center"
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="tm:size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        `
          tm:relative tm:flex tm:cursor-default tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8
          tm:text-sm tm:outline-hidden tm:select-none
          tm:focus:bg-one-bg3 tm:focus:text-light-grey
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
          tm:[&_svg:not([class*='size-'])]:size-4
        `,
        className
      )}
      {...props}
    >
      <span
        className="tm:pointer-events-none tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center"
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="tm:size-2 tm:fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        `
          tm:px-2 tm:py-1.5 tm:text-sm tm:font-medium tm:text-light-grey
          tm:data-inset:pl-8
        `,
        className
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('tm:-mx-1 tm:my-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        'tm:ml-auto tm:text-xs tm:tracking-widest tm:text-grey-fg',
        className
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
