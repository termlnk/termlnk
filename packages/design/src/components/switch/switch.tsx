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

import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        `
          tm:peer tm:group/switch
          tm:relative tm:inline-flex tm:shrink-0 tm:items-center tm:rounded-full tm:border tm:border-transparent
          tm:transition-all tm:outline-none
          tm:after:absolute tm:after:-inset-x-3 tm:after:-inset-y-2
          tm:hover:border-blue
          tm:focus-visible:border-blue tm:focus-visible:ring-3 tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-3 tm:aria-invalid:ring-red/20
          tm:data-[size=default]:h-[18.4px] tm:data-[size=default]:w-8
          tm:data-[size=sm]:h-3.5 tm:data-[size=sm]:w-6
          tm:data-[state=checked]:bg-blue
          tm:data-[state=unchecked]:bg-one-bg2
        `,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="
          tm:pointer-events-none tm:block tm:rounded-full tm:bg-[#fff] tm:shadow-xs tm:ring-0 tm:transition-transform
          tm:group-data-[size=default]/switch:size-4
          tm:group-data-[size=sm]/switch:size-3
          tm:group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]
          tm:group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]
          tm:group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0
          tm:group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0
        "
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
