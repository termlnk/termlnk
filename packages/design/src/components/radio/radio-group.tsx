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

import { CircleIcon } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('tm:grid tm:w-full tm:gap-2', className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        `
          tm:group/radio-group-item tm:peer
          tm:relative tm:flex tm:aspect-square tm:size-4 tm:shrink-0 tm:rounded-full tm:border tm:border-line
          tm:bg-black tm:outline-hidden
          tm:after:absolute tm:after:-inset-x-3 tm:after:-inset-y-2
          tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-[3px] tm:aria-invalid:ring-red/20
          tm:data-[state=checked]:border-blue
        `,
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className={`
          tm:flex tm:size-4 tm:items-center tm:justify-center tm:text-blue
          tm:group-aria-invalid/radio-group-item:text-red
        `}
      >
        <CircleIcon
          className="tm:absolute tm:top-1/2 tm:left-1/2 tm:size-2 tm:-translate-1/2 tm:fill-current"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
