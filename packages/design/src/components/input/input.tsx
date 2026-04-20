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

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../common/cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);

  if (type === 'password') {
    return (
      <div className="tm:relative tm:w-full">
        <input
          type={passwordVisible ? 'text' : 'password'}
          data-slot="input"
          className={cn(
            `
              tm:flex tm:h-10 tm:w-full tm:min-w-0 tm:rounded-md tm:border tm:border-line tm:bg-black tm:px-3 tm:py-2
              tm:pr-9 tm:text-sm tm:text-white tm:outline-hidden tm:transition-colors
              tm:file:border-0 tm:file:bg-black tm:file:text-sm tm:file:font-medium tm:file:text-white
              tm:placeholder:text-grey-fg
              tm:hover:border-blue
              tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
              tm:disabled:cursor-not-allowed tm:disabled:opacity-50
              tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
            `,
            className
          )}
          {...props}
        />
        <button
          type="button"
          className={`
            tm:absolute tm:top-1/2 tm:right-2 tm:inline-flex tm:size-5 tm:-translate-y-1/2 tm:cursor-pointer
            tm:items-center tm:justify-center tm:rounded-sm tm:text-white
            tm:hover:bg-transparent
            tm:focus-visible:ring-0 tm:focus-visible:outline-none
            tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          `}
          onClick={() => setPasswordVisible((visible) => !visible)}
          aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          disabled={props.disabled}
        >
          {passwordVisible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        `
          tm:flex tm:h-10 tm:w-full tm:min-w-0 tm:rounded-md tm:border tm:border-line tm:bg-black tm:px-3 tm:py-2
          tm:text-sm tm:text-white tm:outline-hidden tm:transition-colors
          tm:file:border-0 tm:file:bg-black tm:file:text-sm tm:file:font-medium tm:file:text-white
          tm:placeholder:text-grey-fg
          tm:hover:border-blue
          tm:focus-visible:border-blue tm:focus-visible:ring-[3px] tm:focus-visible:ring-blue/50
          tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          tm:aria-invalid:border-red tm:aria-invalid:ring-red/20
        `,
        className
      )}
      {...props}
    />
  );
}

export { Input };
