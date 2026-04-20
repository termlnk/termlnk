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

import { Separator as SeparatorPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        `
          tm:shrink-0 tm:bg-line
          tm:data-[orientation=horizontal]:h-px tm:data-[orientation=horizontal]:w-full
          tm:data-[orientation=vertical]:h-full tm:data-[orientation=vertical]:w-px
        `,
        className
      )}
      {...props}
    />
  );
}

export { Separator };
