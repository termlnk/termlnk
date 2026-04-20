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

import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function HoverPanel({
  openDelay = 90,
  closeDelay = 120,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return (
    <HoverCardPrimitive.Root
      data-slot="hover-panel"
      closeDelay={closeDelay}
      openDelay={openDelay}
      {...props}
    />
  );
}

function HoverPanelTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-panel-trigger" {...props} />
  );
}

function HoverPanelContent({
  className,
  align = 'center',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-panel-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-panel-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          `
            tm:z-50 tm:flex tm:w-80 tm:origin-(--radix-hover-card-content-transform-origin) tm:flex-col
            tm:overflow-hidden tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:text-white
            tm:shadow-[0_22px_60px_rgba(0,0,0,0.45)] tm:outline-hidden tm:backdrop-blur-xl tm:duration-150
            tm:data-closed:animate-out tm:data-closed:fade-out-0 tm:data-closed:zoom-out-95
            tm:data-open:animate-in tm:data-open:fade-in-0 tm:data-open:zoom-in-95
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
          `,
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

function HoverPanelHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="hover-panel-header"
      className={cn(
        'tm:flex tm:items-start tm:justify-between tm:gap-3 tm:border-b tm:border-line tm:px-4 tm:py-3',
        className
      )}
      {...props}
    />
  );
}

function HoverPanelBody({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="hover-panel-body"
      className={cn('tm:min-h-0 tm:flex-1 tm:overflow-y-auto', className)}
      {...props}
    />
  );
}

function HoverPanelFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="hover-panel-footer"
      className={cn(
        'tm:flex tm:items-center tm:justify-between tm:gap-2 tm:border-t tm:border-line tm:px-4 tm:py-3',
        className
      )}
      {...props}
    />
  );
}

export {
  HoverPanel,
  HoverPanelBody,
  HoverPanelContent,
  HoverPanelFooter,
  HoverPanelHeader,
  HoverPanelTrigger,
};
