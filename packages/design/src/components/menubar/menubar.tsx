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

import { Check, ChevronRight, Circle } from 'lucide-react';
import { Menubar as MenubarPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function MenubarMenu({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />;
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group {...props} />;
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal {...props} />;
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup {...props} />;
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

const Menubar = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      'tm:flex tm:h-9 tm:items-center tm:space-x-1 tm:rounded-md tm:border tm:bg-black tm:p-1 tm:shadow-xs',
      className
    )}
    {...props}
  />
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      `
        tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:px-3 tm:py-1 tm:text-sm tm:font-medium
        tm:outline-hidden tm:select-none
        tm:focus:bg-one-bg3 tm:focus:text-light-grey
        tm:data-[state=open]:bg-one-bg2 tm:data-[state=open]:text-light-grey
      `,
      className
    )}
    {...props}
  />
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      `
        tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm tm:outline-hidden
        tm:select-none
        tm:focus:bg-one-bg3 tm:focus:text-light-grey
        tm:data-[state=open]:bg-one-bg2 tm:data-[state=open]:text-light-grey
      `,
      inset && 'tm:pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="tm:ml-auto tm:size-4" />
  </MenubarPrimitive.SubTrigger>
));
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName;

const MenubarSubContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      `
        tm:z-50 tm:min-w-32 tm:origin-[--radix-menubar-content-transform-origin] tm:overflow-hidden tm:rounded-md
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
));
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName;

const MenubarContent = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(
  (
    { className, align = 'start', alignOffset = -4, sideOffset = 8, ...props },
    ref
  ) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          `
            tm:z-50 tm:min-w-48 tm:origin-[--radix-menubar-content-transform-origin] tm:overflow-hidden tm:rounded-md
            tm:border tm:bg-one-bg tm:p-1 tm:text-light-grey tm:shadow-md
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
            tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
            tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0 tm:data-[state=open]:zoom-in-95
          `,
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
);
MenubarContent.displayName = MenubarPrimitive.Content.displayName;

const MenubarItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      `
        tm:relative tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:px-2 tm:py-1.5 tm:text-sm
        tm:outline-hidden tm:select-none
        tm:focus:bg-one-bg3 tm:focus:text-light-grey
        tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
      `,
      inset && 'tm:pl-8',
      className
    )}
    {...props}
  />
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

const MenubarCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      `
        tm:relative tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8 tm:text-sm
        tm:outline-hidden tm:select-none
        tm:focus:bg-one-bg3 tm:focus:text-light-grey
        tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
      `,
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="tm:size-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
));
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName;

const MenubarRadioItem = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      `
        tm:relative tm:flex tm:cursor-default tm:items-center tm:rounded-xs tm:py-1.5 tm:pr-2 tm:pl-8 tm:text-sm
        tm:outline-hidden tm:select-none
        tm:focus:bg-one-bg3 tm:focus:text-light-grey
        tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
      `,
      className
    )}
    {...props}
  >
    <span className="tm:absolute tm:left-2 tm:flex tm:size-3.5 tm:items-center tm:justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="tm:size-4 tm:fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
));
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName;

const MenubarLabel = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn(
      'tm:px-2 tm:py-1.5 tm:text-sm tm:font-semibold',
      inset && 'tm:pl-8',
      className
    )}
    {...props}
  />
));
MenubarLabel.displayName = MenubarPrimitive.Label.displayName;

const MenubarSeparator = React.forwardRef<
  React.ComponentRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn('tm:-mx-1 tm:my-1 tm:h-px tm:bg-line', className)}
    {...props}
  />
));
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName;

const MenubarShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'tm:ml-auto tm:text-xs tm:tracking-widest tm:text-grey-fg',
        className
      )}
      {...props}
    />
  );
};
MenubarShortcut.displayname = 'MenubarShortcut';

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
