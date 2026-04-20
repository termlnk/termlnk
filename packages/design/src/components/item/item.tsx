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
import { Separator } from '../separator';

function ItemGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(`
        tm:group/item-group
        tm:flex tm:flex-col
      `, className)}
      {...props}
    />
  );
}

function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn('tm:my-0', className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  `
    tm:group/item
    tm:flex tm:flex-wrap tm:items-center tm:rounded-md tm:border tm:border-transparent tm:text-sm tm:outline-hidden
    tm:transition-colors tm:duration-100
    tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
    tm:[a]:transition-colors
    tm:[a]:hover:bg-one-bg2/50
  `,
  {
    variants: {
      variant: {
        default: 'tm:bg-transparent',
        outline: 'tm:border-line',
        muted: 'tm:bg-one-bg/50',
      },
      size: {
        default: 'tm:gap-4 tm:p-4',
        sm: 'tm:gap-2.5 tm:px-4 tm:py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Item({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  `
    tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:gap-2
    tm:group-has-data-[slot=item-description]/item:translate-y-0.5
    tm:group-has-data-[slot=item-description]/item:self-start
    tm:[&_svg]:pointer-events-none
  `,
  {
    variants: {
      variant: {
        default: 'tm:bg-transparent',
        icon: `
          tm:size-8 tm:rounded-xs tm:border tm:bg-one-bg
          tm:[&_svg:not([class*=\'size-\'])]:size-4
        `,
        image:
          `
            tm:size-10 tm:overflow-hidden tm:rounded-xs
            tm:[&_img]:size-full tm:[&_img]:object-cover
          `,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function ItemMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        `
          tm:flex tm:flex-1 tm:flex-col tm:gap-1
          tm:[&+[data-slot=item-content]]:flex-none
        `,
        className
      )}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        'tm:flex tm:w-fit tm:items-center tm:gap-2 tm:text-sm/snug tm:font-medium',
        className
      )}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        'tm:line-clamp-2 tm:text-sm/normal tm:font-normal tm:text-balance tm:text-grey-fg',
        `
          tm:[&>a]:underline tm:[&>a]:underline-offset-4
          tm:[&>a:hover]:text-blue
        `,
        className
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-actions"
      className={cn('tm:flex tm:items-center tm:gap-2', className)}
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        'tm:flex tm:basis-full tm:items-center tm:justify-between tm:gap-2',
        className
      )}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        'tm:flex tm:basis-full tm:items-center tm:justify-between tm:gap-2',
        className
      )}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
