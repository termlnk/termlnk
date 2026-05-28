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

import * as React from 'react';
import { cn } from '../../common/cn';

function Card({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(`
        tm:group/card
        tm:flex tm:flex-col tm:gap-4 tm:overflow-hidden tm:rounded-xl tm:bg-black tm:py-4 tm:text-sm tm:text-white
        tm:ring-1 tm:ring-line
        tm:has-data-[slot=card-footer]:pb-0
        tm:has-[>img:first-child]:pt-0
        tm:data-[size=sm]:gap-3 tm:data-[size=sm]:py-3
        tm:data-[size=sm]:has-data-[slot=card-footer]:pb-0
        tm:*:[img:first-child]:rounded-t-xl
        tm:*:[img:last-child]:rounded-b-xl
      `, className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        `
          tm:group/card-header
          tm:@container/card-header tm:grid tm:auto-rows-min tm:items-start tm:gap-1 tm:rounded-t-xl tm:px-4
          tm:group-data-[size=sm]/card:px-3
          tm:has-data-[slot=card-action]:grid-cols-[1fr_auto]
          tm:has-data-[slot=card-description]:grid-rows-[auto_auto]
          tm:[.border-b]:pb-4
          tm:group-data-[size=sm]/card:[.border-b]:pb-3
        `,
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn(`
        tm:text-base/snug tm:font-medium
        tm:group-data-[size=sm]/card:text-sm
      `, className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('tm:text-sm tm:text-light-grey', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'tm:col-start-2 tm:row-span-2 tm:row-start-1 tm:self-start tm:justify-self-end',
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn(`
        tm:px-4
        tm:group-data-[size=sm]/card:px-3
      `, className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(`
        tm:flex tm:items-center tm:rounded-b-xl tm:border-t tm:bg-one-bg tm:p-4
        tm:group-data-[size=sm]/card:p-3
      `, className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
