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
import { cn } from '../../common/cn';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        `
          tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:items-center tm:justify-center tm:gap-6 tm:rounded-lg
          tm:border-dashed tm:p-6 tm:text-center tm:text-balance
          tm:md:p-12
        `,
        className
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        'tm:flex tm:max-w-sm tm:flex-col tm:items-center tm:gap-2 tm:text-center',
        className
      )}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  `
    tm:mb-2 tm:flex tm:shrink-0 tm:items-center tm:justify-center
    tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
  `,
  {
    variants: {
      variant: {
        default: 'tm:bg-transparent',
        icon: `
          tm:flex tm:size-10 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-lg tm:bg-one-bg tm:text-light-grey
          tm:[&_svg:not([class*='size-'])]:size-6
        `,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      className={cn('tm:text-lg tm:font-medium tm:tracking-tight', className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        `
          tm:text-sm/relaxed tm:text-grey-fg
          tm:[&>a]:underline tm:[&>a]:underline-offset-4
          tm:[&>a:hover]:text-blue
        `,
        className
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        'tm:flex tm:w-full tm:max-w-sm tm:min-w-0 tm:flex-col tm:items-center tm:gap-4 tm:text-sm tm:text-balance',
        className
      )}
      {...props}
    />
  );
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
