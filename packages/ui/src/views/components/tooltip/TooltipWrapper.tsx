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

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@termlnk/design';
import { forwardRef } from 'react';

export interface ITooltipWrapperRef {
  el: HTMLSpanElement | null;
}

export interface ITooltipWrapperProps {
  children: ReactNode;
  title?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const TooltipWrapper = forwardRef<ITooltipWrapperRef, ITooltipWrapperProps>((props, ref) => {
  const { children, title, side = 'top', ...restProps } = props;

  return title
    ? (
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side}>{title}</TooltipContent>
      </Tooltip>
    )
    : (
      children
    );
});
