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

import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        `
          tm:peer
          tm:size-4 tm:shrink-0 tm:rounded-sm tm:border tm:border-one-bg3 tm:bg-black tm:shadow-xs tm:outline-hidden
          tm:transition-shadow
          tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
          tm:data-[state=checked]:border-blue tm:data-[state=checked]:bg-blue tm:data-[state=checked]:text-[#fff]
        `,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="tm:grid tm:place-content-center tm:text-current tm:transition-none"
      >
        <CheckIcon className="tm:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
