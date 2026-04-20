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

const badgeVariants = cva(
  `
    tm:inline-flex tm:w-fit tm:shrink-0 tm:items-center tm:justify-center tm:gap-1 tm:overflow-hidden tm:rounded-full
    tm:border tm:px-2 tm:py-0.5 tm:text-xs tm:font-medium tm:whitespace-nowrap tm:text-white
    tm:transition-[color,box-shadow]
    tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
    tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
    tm:[&>svg]:pointer-events-none tm:[&>svg]:size-3
  `,
  {
    variants: {
      variant: {
        default:
          `
            tm:border-transparent tm:bg-blue tm:text-white
            tm:[a&]:hover:bg-blue/90
          `,
        primary:
          `
            tm:border-transparent tm:bg-blue tm:text-[#fff]
            tm:[a&]:hover:bg-blue/60
          `,
        secondary:
          `
            tm:border-transparent tm:bg-one-bg2 tm:text-white
            tm:[a&]:hover:bg-one-bg2/90
          `,
        destructive:
          `
            tm:border-transparent tm:bg-red tm:text-[#fff]
            tm:focus-visible:ring-red/20
            tm:[a&]:hover:bg-red/90
          `,
        outline:
          `
            tm:text-white
            tm:[a&]:hover:bg-one-bg2 tm:[a&]:hover:text-white
          `,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
