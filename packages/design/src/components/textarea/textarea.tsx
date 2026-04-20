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

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `
          tm:flex tm:min-h-16 tm:w-full tm:rounded-md tm:border tm:border-one-bg3 tm:bg-black tm:px-3 tm:py-2
          tm:text-white tm:shadow-xs tm:outline-hidden tm:transition-[color,box-shadow]
          tm:placeholder:text-grey-fg
          tm:hover:border-blue
          tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
          tm:md:text-sm
        `,
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
