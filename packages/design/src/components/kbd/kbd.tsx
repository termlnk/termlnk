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

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        `
          tm:pointer-events-none tm:inline-flex tm:h-5 tm:w-fit tm:min-w-5 tm:items-center tm:justify-center tm:gap-1
          tm:rounded-xs tm:bg-one-bg tm:px-1 tm:font-sans tm:text-xs tm:font-medium tm:text-grey-fg tm:select-none
        `,
        "tm:[&_svg:not([class*='size-'])]:size-3",
        'tm:in-data-[slot=tooltip-content]:bg-black/15 tm:in-data-[slot=tooltip-content]:text-black',
        className
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('tm:inline-flex tm:items-center tm:gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
