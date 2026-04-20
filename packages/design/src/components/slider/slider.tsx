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
import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '../../common/cn';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        `
          tm:relative tm:flex tm:w-full tm:touch-none tm:items-center tm:select-none
          tm:data-disabled:opacity-50
          tm:data-[orientation=vertical]:h-full tm:data-[orientation=vertical]:min-h-44
          tm:data-[orientation=vertical]:w-auto tm:data-[orientation=vertical]:flex-col
        `,
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          `
            tm:relative tm:grow tm:overflow-hidden tm:rounded-full tm:bg-one-bg2
            tm:data-[orientation=horizontal]:h-1.5 tm:data-[orientation=horizontal]:w-full
            tm:data-[orientation=vertical]:h-full tm:data-[orientation=vertical]:w-1.5
          `
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            `
              tm:absolute tm:bg-blue
              tm:data-[orientation=horizontal]:h-full
              tm:data-[orientation=vertical]:w-full
            `
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={`
            tm:block tm:size-4 tm:shrink-0 tm:rounded-full tm:border tm:border-blue tm:bg-white tm:shadow-xs
            tm:ring-blue/50 tm:transition-[color,box-shadow]
            tm:hover:ring-4
            tm:focus-visible:ring-4 tm:focus-visible:outline-none
            tm:disabled:pointer-events-none tm:disabled:opacity-50
          `}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
