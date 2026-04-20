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

import { Popover as PopoverPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          `
            tm:z-50 tm:w-72 tm:origin-(--radix-popover-content-transform-origin) tm:rounded-md tm:border tm:border-line
            tm:bg-one-bg tm:p-4 tm:text-light-grey tm:shadow-md tm:outline-hidden
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
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
