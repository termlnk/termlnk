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
import * as React from 'react';
import { cn } from '../../common/cn';
import { Button } from '../button';
import { Input } from '../input';
import { Textarea } from '../textarea';

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        `
          tm:group/input-group
          tm:relative tm:flex tm:h-8 tm:w-full tm:min-w-0 tm:items-center tm:rounded-lg tm:border tm:border-one-bg3
          tm:bg-black tm:outline-hidden tm:transition-colors
          tm:has-disabled:opacity-50
          tm:has-[[data-slot=input-group-control]:focus-visible]:border-blue
          tm:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]
          tm:has-[[data-slot=input-group-control]:focus-visible]:ring-blue/50
          tm:has-[[data-slot][aria-invalid=true]]:border-red tm:has-[[data-slot][aria-invalid=true]]:ring-[3px]
          tm:has-[[data-slot][aria-invalid=true]]:ring-red/20
          tm:has-[>[data-align=block-end]]:h-auto tm:has-[>[data-align=block-end]]:flex-col
          tm:has-[>[data-align=block-start]]:h-auto tm:has-[>[data-align=block-start]]:flex-col
          tm:has-[>textarea]:h-auto
          tm:has-[>[data-align=block-end]]:[&>input]:pt-3
          tm:has-[>[data-align=block-start]]:[&>input]:pb-3
          tm:has-[>[data-align=inline-end]]:[&>input]:pr-1.5
          tm:has-[>[data-align=inline-start]]:[&>input]:pl-1.5
        `,
        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  `
    tm:flex tm:h-auto tm:cursor-text tm:items-center tm:justify-center tm:gap-2 tm:py-1.5 tm:text-sm tm:font-medium
    tm:text-grey-fg tm:select-none
    tm:group-data-[disabled=true]/input-group:opacity-50
    tm:[&>kbd]:rounded-[calc(var(--radius)-5px)]
    tm:[&>svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      align: {
        'inline-start': `
          tm:order-first tm:pl-2
          tm:has-[>button]:ml-[-0.3rem]
          tm:has-[>kbd]:ml-[-0.15rem]
        `,
        'inline-end': `
          tm:order-last tm:pr-2
          tm:has-[>button]:mr-[-0.3rem]
          tm:has-[>kbd]:mr-[-0.15rem]
        `,
        'block-start':
          `
            tm:order-first tm:w-full tm:justify-start tm:px-2.5 tm:pt-2
            tm:group-has-[>input]/input-group:pt-2
          `,
        'block-end':
          `
            tm:order-last tm:w-full tm:justify-start tm:px-2.5 tm:pb-2
            tm:group-has-[>input]/input-group:pb-2
          `,
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
);

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return;
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  'tm:flex tm:items-center tm:gap-2 tm:text-sm tm:shadow-none',
  {
    variants: {
      size: {
        xs: `
          tm:h-6 tm:gap-1 tm:rounded-[calc(var(--radius)-3px)] tm:px-1.5
          tm:[&>svg:not([class*=\'size-\'])]:size-3.5
        `,
        sm: '',
        'icon-xs': `
          tm:size-6 tm:rounded-[calc(var(--radius)-3px)] tm:p-0
          tm:has-[>svg]:p-0
        `,
        'icon-sm': `
          tm:size-8 tm:p-0
          tm:has-[>svg]:p-0
        `,
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  }
);

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        `
          tm:flex tm:items-center tm:gap-2 tm:text-sm tm:text-grey-fg
          tm:[&_svg]:pointer-events-none
          tm:[&_svg:not([class*='size-'])]:size-4
        `,
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(`
        tm:flex-1 tm:rounded-none tm:border-0 tm:bg-transparent tm:shadow-none tm:ring-0
        tm:focus-visible:ring-0
        tm:disabled:bg-transparent
        tm:aria-invalid:ring-0
      `, className)}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(`
        tm:flex-1 tm:resize-none tm:rounded-none tm:border-0 tm:bg-transparent tm:py-2 tm:shadow-none tm:ring-0
        tm:focus-visible:ring-0
        tm:disabled:bg-transparent
        tm:aria-invalid:ring-0
      `, className)}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
