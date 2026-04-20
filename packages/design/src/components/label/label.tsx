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

import { Label as LabelPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../../common/cn';

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        `
          tm:flex tm:items-center tm:gap-2 tm:text-sm tm:leading-none tm:font-medium tm:select-none
          tm:group-data-[disabled=true]:pointer-events-none tm:group-data-[disabled=true]:opacity-50
          tm:peer-disabled:cursor-not-allowed tm:peer-disabled:opacity-50
        `,
        className
      )}
      {...props}
    />
  );
}

export { Label };
