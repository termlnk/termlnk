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

import { ChevronDownIcon } from 'lucide-react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(`
        tm:border-b
        tm:last:border-b-0
      `, className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="tm:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          `
            tm:flex tm:flex-1 tm:items-start tm:justify-between tm:gap-4 tm:rounded-md tm:py-4 tm:text-left tm:text-sm
            tm:font-medium tm:outline-hidden tm:transition-all
            tm:hover:underline
            tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
            tm:disabled:pointer-events-none tm:disabled:opacity-50
            tm:[&[data-state=open]>svg]:rotate-180
          `,
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          className={`
            tm:pointer-events-none tm:size-4 tm:shrink-0 tm:translate-y-0.5 tm:text-grey-fg tm:transition-transform
            tm:duration-200
          `}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={`
        tm:overflow-hidden tm:text-sm
        tm:data-[state=closed]:animate-accordion-up
        tm:data-[state=open]:animate-accordion-down
      `}
      {...props}
    >
      <div className={cn('tm:pt-0 tm:pb-4', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
