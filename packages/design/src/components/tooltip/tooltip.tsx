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

import { Tooltip as TooltipPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function TooltipProvider({
  delay,
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider> & { delay?: number }) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delay ?? delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  delay,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & { delay?: number }) {
  return <TooltipPrimitive.Root data-slot="tooltip" delayDuration={delay} {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          `
            tm:z-50 tm:w-fit tm:max-w-xs tm:origin-(--radix-tooltip-content-transform-origin) tm:rounded-md tm:border
            tm:border-line tm:bg-black2 tm:px-3 tm:py-1.5 tm:text-xs tm:text-white
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
            tm:data-[state=closed]:animate-out tm:data-[state=closed]:fade-out-0 tm:data-[state=closed]:zoom-out-95
            tm:data-[state=delayed-open]:animate-in tm:data-[state=delayed-open]:fade-in-0
            tm:data-[state=delayed-open]:zoom-in-95
            tm:data-[state=instant-open]:animate-in tm:data-[state=instant-open]:fade-in-0
            tm:data-[state=instant-open]:zoom-in-95
          `,
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={`
            tm:z-50 tm:size-2.5 tm:translate-y-[calc(-50%-2px)] tm:rotate-45 tm:rounded-[2px] tm:bg-black2
            tm:fill-black2
          `}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
