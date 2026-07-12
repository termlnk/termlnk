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

import type { RemoteSessionEvent } from '@termlnk/shared-terminal';
import type { ITerminalViewProps } from '@termlnk/terminal-ui';
import { ILogService, Quantity } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { IRemoteSessionService, RemoteSessionStatus } from '@termlnk/shared-terminal';
import { ITerminalInputService, ITerminalUIService, TerminalProgressOverlay, TerminalSearch, useGlobalTerminalAppearance, useTerminalSearch, useXterm, useXtermGridProjection, XTERM_PROGRESS_STATE } from '@termlnk/terminal-ui';
import { useCallback, useEffect, useRef } from 'react';
import { EMPTY } from 'rxjs';
import { DriverChangeOverlay } from './DriverChangeOverlay';

/**
 * Joiner-side terminal view — structural twin of `TerminalView` (SSH) and
 * `LocalTerminalView` (PTY). Same `useXterm` hook, same theme/font/render
 * engine config, same search / progress overlays.
 *
 * Per-session subscriptions:
 *   - `data$(sid)` → `term.write(bytes)`
 *   - `event$(sid)` → `snapshot` hydrates the buffer (term.reset + write)
 *   - `status$(sid)` → gate `sendInput` while not connected
 *   - `term.onData` → `remoteService.write(sid, data)`
 *
 * Driver/observer affordances (role badge, request/release keyboard,
 * connection state, last error) live in the tab's `RemoteTabAdornment`.
 *
 * Geometry: the owner PTY's cols/rows are authoritative and never change
 * locally. When the local window differs from the owner's, the grid is
 * PROJECTED into it via `useXtermGridProjection` — the font size scales so
 * the full grid stays visible, centered with letterboxing.
 */
export function RemoteTerminalView(props: ITerminalViewProps): React.JSX.Element | null {
  const { sessionId, theme, allowTransparency } = props;
  const logService = useDependency(ILogService);
  const terminalUIService = useDependency(ITerminalUIService);
  const terminalInputService = useDependency(ITerminalInputService);
  const remoteService = useDependency(IRemoteSessionService, Quantity.OPTIONAL);
  const globalAppearance = useGlobalTerminalAppearance();
  const activeSessionId = useObservable(terminalUIService.activeSessionId$, null);
  const terminalScopeRef = useRef<HTMLDivElement>(null);
  const projectionContainerRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef(false);

  const stateObservable = remoteService?.status$(sessionId) ?? EMPTY;
  const connectionState = useObservable<RemoteSessionStatus>(stateObservable, RemoteSessionStatus.IDLE);
  // Keep a ref view so the onData closure (rebuilt only when sessionId
  // changes) reads the latest status without needing a re-render to refresh.
  useEffect(() => {
    connectedRef.current = connectionState === RemoteSessionStatus.CONNECTED;
  }, [connectionState]);

  const {
    terminalRef,
    xtermRef,
    focus,
    findNext,
    findPrevious,
    clearSearchDecorations,
    searchResult,
    progressState,
  } = useXterm({
    enabled: globalAppearance.isReady,
    // Joiner xterm cols/rows must match the owner's PTY exactly — only then
    // can clear-line / cursor-positioning escapes in the live PtyData stream
    // (e.g. zsh's PROMPT_EOL_MARK clear sequence) target the same cell the
    // owner intended. Auto-fit to the local DOM container would silently
    // recompute cols and break that invariant.
    autoFit: false,
    onData: useCallback((data: string) => {
      if (!remoteService || !connectedRef.current) {
        return;
      }
      remoteService.write(sessionId, data).catch((err) => {
        logService.warn('[RemoteTerminalView] write failed:', err);
      });
    }, [remoteService, sessionId, logService]),
    onResize: useCallback((_rows: number, _cols: number) => {
      // Joiners must not resize the owner's PTY; owner-side resize$ is the
      // sole authority for joiner geometry. With autoFit disabled this never
      // fires from the local container anyway, but keep the no-op so the
      // hook signature stays satisfied.
    }, []),
    shouldFocusOnOpen: activeSessionId === sessionId,
    theme,
    fontFamily: globalAppearance.fontFamily,
    fontSize: globalAppearance.fontSize,
    letterSpacing: globalAppearance.letterSpacing,
    cursorStyle: globalAppearance.cursorStyle,
    cursorBlink: globalAppearance.cursorBlink,
    rendererEngine: globalAppearance.rendererEngine,
    allowTransparency,
    ctrlOrMetaOpenTerminalLink: globalAppearance.ctrlOrMetaOpenTerminalLink,
    terminalInputService,
  });

  // The owner PTY fixes the grid; project it into the local window instead
  // of resizing it — the font size scales so the full grid always fits, and
  // the centered mount element letterboxes the leftover space. Must be
  // called after useXterm so its appearance effect runs first and the
  // projected font size wins over the user-configured one.
  const { gridStyle, refit } = useXtermGridProjection({
    enabled: globalAppearance.isReady,
    xtermRef,
    containerRef: projectionContainerRef,
    fontFamily: globalAppearance.fontFamily,
    fontSize: globalAppearance.fontSize,
    letterSpacing: globalAppearance.letterSpacing,
  });

  // Hydrate the buffer from the inbound snapshot and follow owner-side resize.
  useEffect(() => {
    if (!remoteService || !globalAppearance.isReady) {
      return undefined;
    }
    const sub = remoteService.event$(sessionId).subscribe((event: RemoteSessionEvent) => {
      const term = xtermRef.current;
      if (!term) {
        return;
      }
      if (event.type === 'snapshot') {
        try {
          term.resize(event.cols, event.rows);
        } catch (err) {
          logService.warn('[RemoteTerminalView] xterm.resize failed:', err);
        }
        refit();
        term.reset();
        if (event.serialized) {
          term.write(event.serialized);
        }
        return;
      }
      if (event.type === 'resize') {
        try {
          term.resize(event.cols, event.rows);
        } catch (err) {
          logService.warn('[RemoteTerminalView] xterm.resize failed:', err);
        }
        refit();
      }
    });
    return () => sub.unsubscribe();
  }, [remoteService, sessionId, xtermRef, globalAppearance.isReady, logService, refit]);

  // Stream inbound PTY bytes into the terminal.
  useEffect(() => {
    if (!remoteService || !globalAppearance.isReady) {
      return undefined;
    }
    const sub = remoteService.data$(sessionId).subscribe((bytes) => {
      const term = xtermRef.current;
      if (!term) {
        return;
      }
      term.write(bytes);
    });
    return () => sub.unsubscribe();
  }, [remoteService, sessionId, xtermRef, globalAppearance.isReady]);

  const { isSearchOpen, isSessionActive, handleSearch, closeSearch } = useTerminalSearch({
    sessionId,
    scopeRef: terminalScopeRef,
    terminalUIService,
    focus,
    findNext,
    findPrevious,
    clearSearchDecorations,
  });

  if (!remoteService) {
    return null;
  }

  return (
    <div ref={terminalScopeRef} className={cn('tm:relative tm:size-full')}>
      <div
        ref={projectionContainerRef}
        className={cn('tm:flex tm:size-full tm:items-center tm:justify-center tm:overflow-hidden tm:bg-black')}
        style={theme?.background ? { backgroundColor: theme.background } : undefined}
        onMouseDown={() => focus()}
      >
        <div
          ref={terminalRef}
          className={cn('tm-terminal-view tm:overflow-hidden', {
            'tm:size-full': !gridStyle,
          })}
          style={gridStyle}
        />
      </div>
      <TerminalSearch
        isOpen={isSearchOpen}
        isActive={isSessionActive}
        resultCount={searchResult.resultCount}
        theme={theme}
        onClose={closeSearch}
        onSearch={handleSearch}
        onClearSearch={clearSearchDecorations}
      />
      {progressState.state !== XTERM_PROGRESS_STATE.NONE && (
        <TerminalProgressOverlay progress={progressState} />
      )}
      <DriverChangeOverlay sessionId={sessionId} />
    </div>
  );
}
