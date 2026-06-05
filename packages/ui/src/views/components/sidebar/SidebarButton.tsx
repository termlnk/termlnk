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

import type { CSSProperties, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { cn } from '@termlnk/design';

export interface ISidebarButtonProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  active?: boolean;
  noIcon?: boolean;

  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: (event: MouseEvent<HTMLButtonElement>) => void;

  onMouseEnter?: MouseEventHandler;
  onMouseLeave?: MouseEventHandler;
}

export function SidebarButton(props: ISidebarButtonProps) {
  const {
    className,
    style,
    disabled = false,
    active = false,
    noIcon,
    children,
    onClick,
    onDoubleClick,
    ...restProps
  } = props;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    onClick && onClick(e);
  };

  const handleDoubleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onDoubleClick && onDoubleClick(e);
  };

  return (
    <button
      className={cn(`
        tm:flex tm:h-[48px] tm:w-full tm:animate-in tm:justify-center tm:overflow-hidden tm:border-none
        tm:bg-transparent tm:text-center tm:text-light-grey tm:outline-hidden tm:transition-colors
        tm:hover:bg-one-bg2
      `, {
        '': noIcon,
        'tm:bg-one-bg3': active,
      }, className)}
      type="button"
      style={style}
      disabled={disabled}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...restProps}
    >
      {children}
    </button>
  );
}
