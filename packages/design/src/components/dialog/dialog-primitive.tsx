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
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        `
          tm:fixed tm:inset-0 tm:z-50 tm:bg-darker-black/50 tm:duration-200 tm:fill-mode-both
          tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0
          tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0
        `,
        className
      )}
      {...props}
    />
  );
}

interface IDialogContentProps {
  closable?: boolean;
  onClickClose?: () => void;
}

function DialogContent({
  className,
  children,
  closable = true,
  onClickClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & IDialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          `
            tm:pointer-events-auto tm:fixed tm:top-[50%] tm:left-[50%] tm:z-50 tm:grid tm:max-h-[calc(100vh-2rem)]
            tm:w-full tm:max-w-[calc(100%-2rem)] tm:translate-[-50%] tm:gap-4 tm:overflow-y-auto tm:rounded-lg tm:border tm:border-line
            tm:bg-black tm:p-4 tm:text-white tm:shadow-lg tm:outline-hidden tm:duration-200 tm:fill-mode-both
            tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
            tm:data-[state=open]:animate-in tm:data-[state=open]:fade-in-0 tm:data-[state=open]:zoom-in-95
            tm:sm:max-w-lg
          `,
          className
        )}
        {...props}
      >
        {children}
        {closable && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={`
              tm:absolute tm:top-4 tm:right-4 tm:cursor-pointer tm:rounded-xs tm:opacity-70 tm:backdrop-blur-sm
              tm:hover:text-blue
              tm:focus-visible:ring-2 tm:focus-visible:ring-blue/50 tm:focus-visible:outline-none
              tm:disabled:pointer-events-none
              tm:data-[state=open]:bg-one-bg tm:data-[state=open]:text-white
            `}
            onClick={onClickClose}
          >
            <XIcon className="tm:size-5" />
            <span className="tm:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(`
        tm:flex tm:flex-col tm:gap-2 tm:text-center tm:select-none
        tm:sm:text-left
      `, className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        `
          tm:flex tm:flex-col-reverse tm:gap-1
          tm:sm:flex-row tm:sm:justify-end
        `,
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('tm:text-lg tm:leading-none tm:font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('tm:text-sm tm:text-grey-fg', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
