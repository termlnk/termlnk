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
import { cn } from '../../common/cn';
import { Separator } from '../separator';

const buttonGroupVariants = cva(
  `
    tm:flex tm:w-fit tm:items-stretch
    tm:*:focus-visible:relative tm:*:focus-visible:z-10
    tm:has-[>[data-slot=button-group]]:gap-2
    tm:has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg
    tm:[&>[data-slot=select-trigger]:not([class*='tm:w-'])]:w-fit
    tm:[&>input]:flex-1
  `,
  {
    variants: {
      orientation: {
        horizontal:
          `
            tm:[&>*:not(:first-child)]:rounded-l-none tm:[&>*:not(:first-child)]:border-l-0
            tm:[&>*:not(:last-child)]:rounded-r-none
            tm:[&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg!
          `,
        vertical:
          `
            tm:flex-col
            tm:[&>*:not(:first-child)]:rounded-t-none tm:[&>*:not(:first-child)]:border-t-0
            tm:[&>*:not(:last-child)]:rounded-b-none
            tm:[&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg!
          `,
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
);

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : 'div';

  return (
    <Comp
      className={cn(
        `
          tm:flex tm:h-8 tm:items-center tm:gap-2 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg/30 tm:px-2.5
          tm:text-sm tm:font-medium tm:text-light-grey
          tm:[&_svg]:pointer-events-none
          tm:[&_svg:not([class*='size-'])]:size-4
        `,
        className
      )}
      {...props}
    />
  );
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        `
          tm:relative tm:self-stretch tm:bg-line
          tm:data-[orientation=horizontal]:mx-px tm:data-[orientation=horizontal]:w-auto
          tm:data-[orientation=vertical]:my-px tm:data-[orientation=vertical]:h-auto
        `,
        className
      )}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
