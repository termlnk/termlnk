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

import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { Platform, platform } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { IWindowManagerService } from '@termlnk/electron';
import { Maximize2, Minus, Square, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface IWindowControlsProps {
  windowId: number | null;
  isMaximized: boolean;
  isFullScreen: boolean;
  minimizable: boolean;
  maximizable: boolean;
}

function useWindowFocusState(): boolean {
  const [isFocused, setIsFocused] = useState(document.hasFocus());

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return isFocused;
}

function WindowsRestoreIcon({ className, ...props }: ComponentPropsWithoutRef<'svg'>): ReactElement {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path
        d="M3.25 1.75H8.25V6.75"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        strokeLinejoin="miter"
        shapeRendering="crispEdges"
      />
      <rect
        x="1.75"
        y="3.25"
        width="5"
        height="5"
        stroke="currentColor"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

export function TrafficLightWindowControls({ windowId, isFullScreen, minimizable, maximizable }: IWindowControlsProps): ReactElement | null {
  const windowManagerService = useDependency(IWindowManagerService);
  const isFocused = useWindowFocusState();
  const maximizeUsesFullScreen = platform === Platform.Mac;

  const handleClose = useCallback(() => {
    if (windowId === null) {
      return;
    }

    windowManagerService.closeWindow(windowId);
  }, [windowManagerService, windowId]);

  const handleMinimize = useCallback(() => {
    if (windowId === null) {
      return;
    }

    windowManagerService.minimizeWindow(windowId);
  }, [windowManagerService, windowId]);

  const handleMaximize = useCallback(() => {
    if (windowId === null) {
      return;
    }

    if (maximizeUsesFullScreen) {
      windowManagerService.toggleFullScreen(windowId);
      return;
    }

    windowManagerService.toggleMaximizeWindow(windowId);
  }, [maximizeUsesFullScreen, windowManagerService, windowId]);

  if (isFullScreen) {
    return null;
  }

  return (
    <div className="electron-no-drag tm:flex tm:shrink-0 tm:items-center tm:pl-3">
      <div
        className="
          tm:group
          tm:flex tm:items-center tm:gap-2
        "
      >
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            `
              tm:flex tm:size-3.5 tm:items-center tm:justify-center tm:rounded-full tm:text-[#353535] tm:outline-1
              tm:-outline-offset-1 tm:transition-colors
            `,
            {
              'tm:bg-[#ec6765] tm:outline-[#e73e3b]': isFocused,
              'tm:bg-[#d4d4d4] tm:outline-[#cacaca]': !isFocused,
              'tm:group-hover:bg-[#ec6765] tm:group-hover:outline-[#e73e3b]': !isFocused,
            }
          )}
        >
          <X
            className="
              tm:hidden tm:size-2.5
              tm:group-hover:block
            "
          />
        </button>
        <button
          type="button"
          onClick={handleMinimize}
          disabled={!minimizable}
          className={cn(
            `
              tm:flex tm:size-3.5 tm:items-center tm:justify-center tm:rounded-full tm:text-[#353535] tm:outline-1
              tm:-outline-offset-1 tm:transition-colors
            `,
            {
              'tm:bg-[#f2ca44] tm:outline-[#eebb0d]': isFocused && minimizable,
              'tm:bg-[#d4d4d4] tm:outline-[#cacaca]': !isFocused || !minimizable,
              'tm:group-hover:bg-[#f2ca44] tm:group-hover:outline-[#eebb0d]': !isFocused && minimizable,
              'tm:pointer-events-none': !minimizable,
            }
          )}
        >
          <Minus
            className="
              tm:hidden tm:size-2.5
              tm:group-hover:block
            "
          />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          disabled={!maximizable}
          className={cn(
            `
              tm:flex tm:size-3.5 tm:items-center tm:justify-center tm:rounded-full tm:text-[#353535] tm:outline-1
              tm:-outline-offset-1 tm:transition-colors
            `,
            {
              'tm:bg-[#65c466] tm:outline-[#49ba4b]': isFocused && maximizable,
              'tm:bg-[#d4d4d4] tm:outline-[#cacaca]': !isFocused || !maximizable,
              'tm:group-hover:bg-[#65c466] tm:group-hover:outline-[#49ba4b]': !isFocused && maximizable,
              'tm:pointer-events-none': !maximizable,
            }
          )}
        >
          <Maximize2
            className="
              tm:hidden tm:size-2
              tm:group-hover:block
            "
          />
        </button>
      </div>
    </div>
  );
}

export function WindowsWindowControls({ windowId, isMaximized, isFullScreen, minimizable, maximizable }: IWindowControlsProps): ReactElement | null {
  const windowManagerService = useDependency(IWindowManagerService);
  const isFocused = useWindowFocusState();

  const handleClose = useCallback(() => {
    if (windowId === null) {
      return;
    }

    windowManagerService.closeWindow(windowId);
  }, [windowManagerService, windowId]);

  const handleMinimize = useCallback(() => {
    if (windowId === null) {
      return;
    }

    windowManagerService.minimizeWindow(windowId);
  }, [windowManagerService, windowId]);

  const handleMaximize = useCallback(() => {
    if (windowId === null) {
      return;
    }

    windowManagerService.toggleMaximizeWindow(windowId);
  }, [windowManagerService, windowId]);

  if (isFullScreen) {
    return null;
  }

  return (
    <div className="electron-no-drag tm:flex tm:h-full tm:shrink-0 tm:items-center tm:gap-0.5 tm:pr-1.5 tm:pl-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleMinimize}
        disabled={!minimizable}
        className={cn({
          'tm:text-white': isFocused,
          'tm:text-light-grey': !isFocused,
        })}
      >
        <Minus className="tm:size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleMaximize}
        disabled={!maximizable}
        className={cn({
          'tm:text-white': isFocused,
          'tm:text-light-grey': !isFocused,
        })}
      >
        {isMaximized ?
          <WindowsRestoreIcon className="tm:size-3.5" />
          : <Square className="tm:size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClose}
        className={cn(
          `
            tm:hover:bg-[#e81123] tm:hover:text-[#fff]
            tm:focus-visible:border-[#e81123] tm:focus-visible:ring-[#e81123]/35
            tm:active:bg-[#c50f1f]
          `,
          {
            'tm:text-white': isFocused,
            'tm:text-light-grey': !isFocused,
          }
        )}
      >
        <X className="tm:size-4" />
      </Button>
    </div>
  );
}

export function WindowControls(props: IWindowControlsProps): ReactElement {
  const usesTrafficLightControls = platform === Platform.Mac || platform === Platform.Linux;

  if (usesTrafficLightControls) {
    return <TrafficLightWindowControls {...props} />;
  }

  return <WindowsWindowControls {...props} />;
}
