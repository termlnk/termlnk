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
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

const buttonVariants = cva(
  `
    tm:group/button
    tm:inline-flex tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md tm:border tm:border-transparent
    tm:bg-transparent tm:text-sm tm:font-medium tm:whitespace-nowrap tm:outline-hidden
    tm:transition-[color,box-shadow,background-color,border-color] tm:select-none
    tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
    tm:disabled:pointer-events-none tm:disabled:opacity-50
    tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
    tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
    tm:[&_svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      variant: {
        default: 'tm:text-white',
        primary: `
          tm:bg-blue tm:text-[#fff]
          tm:hover:bg-nord-blue
          tm:disabled:bg-one-bg3 tm:disabled:text-[#fff] tm:disabled:opacity-100
        `,
        outline: `
          tm:border-line tm:bg-black tm:text-white
          tm:hover:bg-one-bg tm:hover:text-white
          tm:aria-expanded:bg-one-bg2 tm:aria-expanded:text-light-grey
        `,
        secondary: `
          tm:bg-one-bg tm:text-white
          tm:hover:bg-one-bg2
          tm:aria-expanded:bg-one-bg3 tm:aria-expanded:text-white
        `,
        ghost: `
          tm:bg-transparent tm:text-white
          tm:hover:bg-one-bg tm:hover:text-white
          tm:aria-expanded:bg-one-bg2 tm:aria-expanded:text-white
        `,
        destructive: `
          tm:bg-red tm:text-[#fff]
          tm:hover:bg-red/90
          tm:focus-visible:border-red tm:focus-visible:ring-red/20
          tm:active:bg-red/80
        `,
        link: `
          tm:text-blue tm:underline-offset-4
          tm:hover:underline
        `,
      },
      size: {
        default: `
          tm:h-8 tm:gap-1.5 tm:px-2.5
          tm:data-[icon=inline-end]:pr-2
          tm:data-[icon=inline-start]:pl-2
        `,
        xs: `
          tm:h-6 tm:gap-1 tm:px-2 tm:text-xs
          tm:data-[icon=inline-end]:pr-1.5
          tm:data-[icon=inline-start]:pl-1.5
          tm:[&_svg:not([class*='size-'])]:size-3
        `,
        sm: `
          tm:h-7 tm:gap-1 tm:px-2.5 tm:text-[0.8rem]
          tm:data-[icon=inline-end]:pr-1.5
          tm:data-[icon=inline-start]:pl-1.5
          tm:[&_svg:not([class*='size-'])]:size-3.5
        `,
        lg: `
          tm:h-9 tm:gap-1.5 tm:px-2.5
          tm:data-[icon=inline-end]:pr-3
          tm:data-[icon=inline-start]:pl-3
        `,
        icon: 'tm:size-8 tm:p-0',
        'icon-xs': `
          tm:size-6 tm:p-0
          tm:[&_svg:not([class*=\'size-\'])]:size-3
        `,
        'icon-sm': 'tm:size-7 tm:p-0',
        'icon-lg': 'tm:size-9 tm:p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
