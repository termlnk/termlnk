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

import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';
import { Button } from '../button';

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(`
        tm:fixed tm:inset-0 tm:z-50 tm:bg-black/10 tm:duration-100
        tm:data-closed:animate-out tm:data-closed:fade-out-0
        tm:data-ending-style:opacity-0
        tm:data-open:animate-in tm:data-open:fade-in-0
        tm:data-starting-style:opacity-0
        tm:supports-backdrop-filter:backdrop-blur-xs
      `, className)}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(`
          tm:fixed tm:z-50 tm:flex tm:flex-col tm:gap-4 tm:bg-one-bg tm:bg-clip-padding tm:text-sm tm:shadow-lg
          tm:transition tm:duration-200 tm:ease-in-out
          tm:data-closed:animate-out tm:data-closed:fade-out-0
          tm:data-open:animate-in tm:data-open:fade-in-0
          tm:data-[side=bottom]:inset-x-0 tm:data-[side=bottom]:bottom-0 tm:data-[side=bottom]:h-auto
          tm:data-[side=bottom]:border-t
          tm:data-[side=bottom]:data-closed:slide-out-to-bottom-10
          tm:data-[side=bottom]:data-open:slide-in-from-bottom-10
          tm:data-[side=left]:inset-y-0 tm:data-[side=left]:left-0 tm:data-[side=left]:h-full tm:data-[side=left]:w-3/4
          tm:data-[side=left]:border-r
          tm:data-[side=left]:data-closed:slide-out-to-left-10
          tm:data-[side=left]:data-open:slide-in-from-left-10
          tm:data-[side=right]:inset-y-0 tm:data-[side=right]:right-0 tm:data-[side=right]:h-full
          tm:data-[side=right]:w-3/4 tm:data-[side=right]:border-l
          tm:data-[side=right]:data-closed:slide-out-to-right-10
          tm:data-[side=right]:data-open:slide-in-from-right-10
          tm:data-[side=top]:inset-x-0 tm:data-[side=top]:top-0 tm:data-[side=top]:h-auto tm:data-[side=top]:border-b
          tm:data-[side=top]:data-closed:slide-out-to-top-10
          tm:data-[side=top]:data-open:slide-in-from-top-10
          tm:data-[side=left]:sm:max-w-sm
          tm:data-[side=right]:sm:max-w-sm
        `, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button variant="ghost" className="tm:absolute tm:top-3 tm:right-3" size="icon-sm">
              <XIcon />
              <span className="tm:sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('tm:flex tm:flex-col tm:gap-0.5 tm:p-4', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('tm:mt-auto tm:flex tm:flex-col tm:gap-2 tm:p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('tm:text-base tm:font-medium tm:text-light-grey', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('tm:text-sm tm:text-grey-fg', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
