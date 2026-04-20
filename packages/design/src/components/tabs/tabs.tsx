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

import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '../../common/cn';

interface TabsProps extends ComponentProps<typeof TabsPrimitive.Root> {
  orientation?: 'horizontal' | 'vertical';
}

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        'tm:flex tm:gap-2',
        orientation === 'vertical' ? 'tm:flex-row' : 'tm:flex-col',
        className
      )}
      {...props}
    />
  );
}

interface TabsListProps extends ComponentProps<typeof TabsPrimitive.List> {
  orientation?: 'horizontal' | 'vertical';
}

function TabsList({
  className,
  orientation = 'horizontal',
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        orientation === 'vertical'
          ? 'tm:flex tm:w-fit tm:flex-col tm:items-stretch tm:gap-1 tm:p-1 tm:text-grey-fg2'
          : `
            tm:inline-flex tm:h-10 tm:w-fit tm:items-center tm:justify-center tm:gap-1 tm:rounded-lg tm:bg-one-bg tm:p-1
          `,
        className
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends ComponentProps<typeof TabsPrimitive.Trigger> {
  orientation?: 'horizontal' | 'vertical';
}

function TabsTrigger({
  className,
  orientation = 'horizontal',
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        orientation === 'vertical'
          ? `
            tm:relative tm:flex tm:cursor-pointer tm:items-center tm:justify-start tm:gap-2 tm:px-4 tm:py-2.5 tm:text-sm
            tm:font-medium tm:whitespace-nowrap tm:text-white tm:transition-colors
            tm:hover:text-white
            tm:focus-visible:ring-2 tm:focus-visible:ring-blue/50 tm:focus-visible:outline-none
            tm:disabled:pointer-events-none tm:disabled:opacity-50
            tm:data-[state=active]:text-white
            tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
            tm:[&_svg:not([class*='size-'])]:size-4
          `
          : `
            tm:inline-flex tm:h-full tm:cursor-pointer tm:items-center tm:justify-center tm:gap-1.5 tm:rounded-md
            tm:px-3 tm:py-1.5 tm:text-sm tm:font-medium tm:whitespace-nowrap tm:text-white tm:transition-all
            tm:hover:text-white
            tm:focus-visible:ring-2 tm:focus-visible:ring-blue/50 tm:focus-visible:outline-none
            tm:disabled:pointer-events-none tm:disabled:opacity-50
            tm:data-[state=active]:bg-one-bg3 tm:data-[state=active]:text-white tm:data-[state=active]:shadow-xs
            tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0
            tm:[&_svg:not([class*='size-'])]:size-4
          `,
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('tm:flex-1 tm:outline-hidden', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
