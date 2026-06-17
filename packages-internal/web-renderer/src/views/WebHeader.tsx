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

import { INotificationService } from '@termlnk/core';
import { Button, Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { BuiltInUIPart, ComponentContainer, NotificationIcon, NotificationPanel, ResizableService, SIDE_TAB_BAR_WIDTH_REM, SideTabBarService, useComponentsOfPart } from '@termlnk/ui';
import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * WebHeader — browser-side counterpart to DesktopHeader.
 *
 * Identical layout grammar as the Electron header (left = HEADER_ACTION
 * slot, right = TAB_BAR + notification + HEADER_TRAILING) so the existing
 * UI plugins keep registering into the same BuiltInUIPart slots without
 * any awareness of which shell renders them. Differences:
 *
 * - No traffic-light / Windows window control buttons. Browsers don't own
 *   a window chrome; the OS / tab UI handles minimise / close.
 * - No `electron-dragable` / `electron-no-drag` CSS — those classes are
 *   the contract between Electron's BrowserWindow and DOM events. In a
 *   plain browser the whole region is just regular DOM.
 * - No WindowPinToggle (always-on-top is an Electron concept).
 * - Adds a Sign-out button on the trailing edge wired to the
 *   `__termlnkWebLogout` global that WebShell exposes after login. The
 *   indirection avoids dragging the whole login state machine into a
 *   leaf component; WebShell owns the lifecycle.
 */
export function WebHeader() {
  const resizableService = useDependency(ResizableService);
  const sideTabBarService = useDependency(SideTabBarService);
  const notificationService = useDependency(INotificationService);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationTriggerRef = useRef<HTMLDivElement | null>(null);
  const [notificationPanelRight, setNotificationPanelRight] = useState(8);

  const layout = useObservable(resizableService.layout$, resizableService.layout);
  const isPanelOpen = useObservable(notificationService.isPanelOpen$, false);
  const isSidebarVisible = useObservable(sideTabBarService.visible$, sideTabBarService.visible);
  const tabBarComponents = useComponentsOfPart(BuiltInUIPart.TAB_BAR);
  const headerActionComponents = useComponentsOfPart(BuiltInUIPart.HEADER_ACTION);
  const headerTrailingComponents = useComponentsOfPart(BuiltInUIPart.HEADER_TRAILING);

  // Notification panel: click-outside dismissal — same behaviour the
  // Electron shell relies on; we duplicate the effect here rather than
  // sharing it because reaching into another package's view file would
  // make the contract worse than copy-paste.
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
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

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isPanelOpen, notificationService]);

  // Pin the notification panel right edge under the trigger icon — the
  // trailing slot grows / shrinks as plugins register, so the offset can't
  // be a constant.
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }
    const updatePosition = () => {
      const headerEl = headerRef.current;
      const triggerEl = notificationTriggerRef.current;
      if (!headerEl || !triggerEl) {
        return;
      }
      const headerRect = headerEl.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();
      const rightOffset = Math.max(8, Math.round(headerRect.right - triggerRect.right));
      setNotificationPanelRight(rightOffset);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [isPanelOpen, headerTrailingComponents.length]);

  const leftPercent = layout.left;
  const hasHeaderActions = headerActionComponents.length > 0;
  const sideTabBarWidth = isSidebarVisible ? SIDE_TAB_BAR_WIDTH_REM : 0;

  const handleLogout = () => {
    const fn = (window as unknown as { __termlnkWebLogout?: () => void }).__termlnkWebLogout;
    if (typeof fn === 'function') {
      fn();
    }
  };

  const signOutLabel = 'Sign out';

  return (
    <div ref={headerRef} className="tm:relative">
      <div
        className={`
          tm:flex tm:h-8.75 tm:min-h-8.75 tm:w-full tm:border-b tm:border-line tm:bg-darker-black tm:select-none
        `}
      >
        {/* Left area: header-action slot (e.g. SFTP toggle). No traffic lights, no electron drag region. */}
        <div
          className="tm:relative tm:flex tm:shrink-0 tm:items-stretch"
          style={{
            width: `calc(${sideTabBarWidth}rem + (100% - ${sideTabBarWidth}rem) * ${leftPercent / 100})`,
            minWidth: 'max-content',
          }}
        >
          {hasHeaderActions && (
            <div
              className="tm:flex tm:h-full tm:items-center tm:justify-center tm:gap-0.5 tm:px-2"
            >
              <ComponentContainer components={headerActionComponents} />
            </div>
          )}
          <div className="tm:absolute tm:top-[25%] tm:right-0 tm:h-[50%] tm:w-px tm:bg-line" />
        </div>

        {/* Right area: terminal tab bar + notification + header trailing slot + logout button. */}
        <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-1 tm:overflow-hidden">
          <div className="tm:min-w-0 tm:flex-1">
            <ComponentContainer components={tabBarComponents} />
          </div>
          <div className="tm:flex tm:shrink-0 tm:items-center tm:gap-0.5 tm:px-1.5">
            <div ref={notificationTriggerRef} className="tm:flex tm:items-center">
              <NotificationIcon />
            </div>
            {headerTrailingComponents.length > 0 && (
              <ComponentContainer components={headerTrailingComponents} />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  aria-label={signOutLabel}
                >
                  <LogOut size={14} strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{signOutLabel}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

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
