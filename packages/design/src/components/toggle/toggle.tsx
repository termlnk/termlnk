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

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

const toggleVariants = cva(
  `
    tm:group/toggle
    tm:inline-flex tm:items-center tm:justify-center tm:gap-1 tm:rounded-lg tm:border tm:border-transparent
    tm:bg-transparent tm:text-sm tm:font-medium tm:whitespace-nowrap tm:text-light-grey tm:outline-hidden
    tm:transition-[color,box-shadow,background-color,border-color]
    tm:hover:bg-one-bg2 tm:hover:text-light-grey
    tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
    tm:disabled:pointer-events-none tm:disabled:opacity-50
    tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
    tm:data-[state=on]:bg-one-bg2
    tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
    tm:[&_svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      variant: {
        default: 'tm:bg-transparent',
        outline: `
          tm:border-line tm:bg-one-bg/30
          tm:hover:bg-one-bg2
        `,
      },
      size: {
        default: 'tm:h-8 tm:min-w-8 tm:px-2',
        sm: 'tm:h-7 tm:min-w-7 tm:rounded-md tm:px-1.5 tm:text-[0.8rem]',
        lg: 'tm:h-9 tm:min-w-9 tm:px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
