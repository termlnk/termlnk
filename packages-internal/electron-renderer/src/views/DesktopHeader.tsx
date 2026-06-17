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

import type { IWindowState } from '@termlnk/electron';
import { INotificationService, Platform, platform } from '@termlnk/core';
import { useDependency, useObservable } from '@termlnk/design';
import { IWindowManagerService } from '@termlnk/electron';
import { BuiltInUIPart, ComponentContainer, NotificationIcon, NotificationPanel, ResizableService, SIDE_TAB_BAR_WIDTH_REM, SideTabBarService, useComponentsOfPart } from '@termlnk/ui';
import { useEffect, useRef, useState } from 'react';
import { TrafficLightWindowControls, WindowsWindowControls } from './WindowControls';
import { WindowPinToggle } from './WindowPinToggle';

export function DesktopHeader() {
  const windowManagerService = useDependency(IWindowManagerService);
  const resizableService = useDependency(ResizableService);
  const sideTabBarService = useDependency(SideTabBarService);
  const notificationService = useDependency(INotificationService);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [windowState, setWindowState] = useState<IWindowState | null>(null);
  const [notificationPanelRight, setNotificationPanelRight] = useState(8);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationTriggerRef = useRef<HTMLDivElement | null>(null);

  const layout = useObservable(resizableService.layout$, resizableService.layout);
  const isPanelOpen = useObservable(notificationService.isPanelOpen$, false);
  const isSidebarVisible = useObservable(sideTabBarService.visible$, sideTabBarService.visible);
  const tabBarComponents = useComponentsOfPart(BuiltInUIPart.TAB_BAR);
  const headerActionComponents = useComponentsOfPart(BuiltInUIPart.HEADER_ACTION);
  const headerTrailingComponents = useComponentsOfPart(BuiltInUIPart.HEADER_TRAILING);

  useEffect(() => {
    windowManagerService.getCurrentWindowId().then((id) => {
      setWindowId(id);
    });
  }, [windowManagerService]);

  useEffect(() => {
    if (windowId === null) {
      return;
    }

    const subscription = windowManagerService.getWindowState$(windowId).subscribe((state) => {
      setWindowState(state);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [windowManagerService, windowId]);

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) {
        return;
      }

      if (notificationPanelRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest('[data-notification-trigger="true"]')) {
        return;
      }

      notificationService.closePanel();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [isPanelOpen, notificationService]);

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const updateNotificationPanelPosition = () => {
      const headerElement = headerRef.current;
      const triggerElement = notificationTriggerRef.current;
      if (!headerElement || !triggerElement) {
        return;
      }

      const headerRect = headerElement.getBoundingClientRect();
      const triggerRect = triggerElement.getBoundingClientRect();
      const rightOffset = Math.max(8, Math.round(headerRect.right - triggerRect.right));
      setNotificationPanelRight(rightOffset);
    };

    updateNotificationPanelPosition();
    window.addEventListener('resize', updateNotificationPanelPosition);

    return () => {
      window.removeEventListener('resize', updateNotificationPanelPosition);
    };
  }, [isPanelOpen, headerTrailingComponents.length]);

  const fullScreen = windowState?.fullScreen ?? false;
  const isMaximized = windowState?.isMaximized ?? false;
  const minimizable = windowState?.minimizable ?? true;
  const maximizable = windowState?.maximizable ?? true;
  const leftPercent = layout.left;
  const hasHeaderActions = headerActionComponents.length > 0;
  const sideTabBarWidth = isSidebarVisible ? SIDE_TAB_BAR_WIDTH_REM : 0;
  const usesTrafficLightControls = platform === Platform.Mac || platform === Platform.Linux;
  const showTrafficLightControls = usesTrafficLightControls && !fullScreen;

  const windowControlProps = {
    windowId,
    isMaximized,
    isFullScreen: fullScreen,
    minimizable,
    maximizable,
  };

  return (
    <div ref={headerRef} className="tm:relative">
      <div
        className={`
          electron-dragable tm:flex tm:h-8.75 tm:min-h-8.75 tm:w-full tm:border-b tm:border-line tm:bg-darker-black
          tm:select-none
        `}
      >
        {/* Left area - traffic lights + header actions */}
        <div
          className="tm:relative tm:flex tm:shrink-0 tm:items-stretch"
          style={{
            width: `calc(${sideTabBarWidth}rem + (100% - ${sideTabBarWidth}rem) * ${leftPercent / 100})`,
            minWidth: 'max-content',
          }}
        >
          {showTrafficLightControls && (
            <TrafficLightWindowControls {...windowControlProps} />
          )}
          {/* Header action buttons (e.g., SFTP) */}
          {hasHeaderActions && (
            <div
              className="electron-no-drag tm:flex tm:h-full tm:items-center tm:justify-center tm:gap-0.5 tm:px-2"
            >
              <ComponentContainer components={headerActionComponents} />
            </div>
          )}
          {/* Short centered divider */}
          <div className="tm:absolute tm:top-[25%] tm:right-0 tm:h-[50%] tm:w-px tm:bg-line" />
        </div>

        {/* Right area - Tab bar */}
        <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-1 tm:overflow-hidden">
          <div className="tm:min-w-0 tm:flex-1">
            <ComponentContainer components={tabBarComponents} />
          </div>
          <div
            className="electron-no-drag tm:flex tm:shrink-0 tm:items-center tm:gap-0.5 tm:px-1.5"
          >
            <div ref={notificationTriggerRef} className="tm:flex tm:items-center">
              <NotificationIcon />
            </div>
            {headerTrailingComponents.length > 0 && (
              <ComponentContainer components={headerTrailingComponents} />
            )}
            <WindowPinToggle windowId={windowId} alwaysOnTop={windowState?.alwaysOnTop ?? false} />
          </div>
          {!usesTrafficLightControls && (
            <WindowsWindowControls {...windowControlProps} />
          )}
        </div>
      </div>

      {/* Notification Panel */}
      {isPanelOpen && (
        <div
          ref={notificationPanelRef}
          className={`
            tm:absolute tm:top-8.5 tm:z-50 tm:h-80 tm:w-70 tm:animate-in tm:overflow-hidden tm:rounded-xl tm:border
            tm:border-line tm:bg-black tm:shadow-2xl tm:shadow-black/50 tm:duration-200 tm:ease-out tm:fade-in-0
            tm:zoom-in-95 tm:slide-in-from-top-2
          `}
          style={{ right: `${notificationPanelRight}px` }}
        >
          <NotificationPanel />
        </div>
      )}
    </div>
  );
}
