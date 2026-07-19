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

import type { TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import type { ITerminalViewProps } from '../../services/terminal/terminal-view-registry.service';
import { isWindows } from '@termlnk/core';
import { useDependency, useObservable } from '@termlnk/design';
import { formatXtVersionResponse, IPTYService, IShellIntegrationService, PTYSessionStatus } from '@termlnk/terminal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ILastCwdService } from '../../services/local-terminal/last-cwd.service';
import { ITerminalInputService } from '../../services/terminal-input/terminal-input.service';
import { ITerminalPersistenceService } from '../../services/terminal/terminal-persistence.service';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { useGlobalTerminalAppearance, useXterm, XTERM_PROGRESS_STATE } from '../hooks';
import { TerminalDropOverlay } from '../terminal/TerminalDropOverlay';
import { TerminalProgressOverlay } from '../terminal/TerminalProgressOverlay';
import { TerminalSearch } from '../terminal/TerminalSearch';
import { useTerminalDrop } from '../terminal/use-terminal-drop';
import { useTerminalSearch } from '../terminal/use-terminal-search';
import { useErrorFixNotice } from '../use-error-fix-notice';
import { useOscNotification } from '../use-osc-notification';
import { useShellIntegration } from '../use-shell-integration';
import { useSuggestionSpinner } from '../use-suggestion-spinner';

export function LocalTerminalView(props: ITerminalViewProps) {
  const { sessionId, theme, allowTransparency } = props;
  const ptyService = useDependency(IPTYService);
  const terminalUIService = useDependency(ITerminalUIService);
  const persistenceService = useDependency(ITerminalPersistenceService);
  const shellIntegrationService = useDependency(IShellIntegrationService);
  const terminalInputService = useDependency(ITerminalInputService);
  const globalAppearance = useGlobalTerminalAppearance();
  const lastCwdService = useDependency(ILastCwdService);
  const activeSessionId = useObservable(terminalUIService.activeSessionId$, null);
  const connectedRef = useRef(false);
  const cwdRef = useRef<string>('');
  const terminalScopeRef = useRef<HTMLDivElement>(null);
  const [shellPath, setShellPath] = useState<string | null>(null);

  // notifyUserInput from useSuggestionSpinner is captured by ref so the
  // onData callback (built before the spinner hook runs because it needs
  // xtermRef from useXterm) can reach the latest version.
  const notifyUserInputRef = useRef<() => void>(() => {});

  const { terminalRef, xtermRef, write, fit, focus, getSize, serialize, findNext, findPrevious, clearSearchDecorations, searchResult, progressState } = useXterm({
    enabled: globalAppearance.isReady,
    onData: useCallback((data: string) => {
      if (connectedRef.current) {
        notifyUserInputRef.current();
        ptyService.write(sessionId, data).catch(console.error);
      }
    }, [ptyService, sessionId]),
    onResize: useCallback((rows: number, cols: number) => {
      if (connectedRef.current) {
        ptyService.resize(sessionId, rows, cols).catch(console.error);
      }
    }, [ptyService, sessionId]),
    onTitleChange: useCallback((title: string) => {
      terminalUIService.updateSessionTitle(sessionId, title);
    }, [terminalUIService, sessionId]),
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
    // Local PTY uses ConPTY on Windows; tell xterm.js so it applies cursor/clear workarounds.
    windowsPty: isWindows ? { backend: 'conpty' } : undefined,
    terminalInputService,
  });

  const { isSearchOpen, isSessionActive, handleSearch, closeSearch } = useTerminalSearch({
    sessionId,
    scopeRef: terminalScopeRef,
    terminalUIService,
    focus,
    findNext,
    findPrevious,
    clearSearchDecorations,
  });

  const { onOsc633 } = useShellIntegration({
    sessionId,
    xtermRef,
    shellIntegrationService,
  });

  useOscNotification({
    sessionId,
    xtermRef,
    enabled: globalAppearance.isReady,
  });

  const { notifyUserInput } = useSuggestionSpinner({ sessionId, xtermRef });
  useEffect(() => {
    notifyUserInputRef.current = notifyUserInput;
  }, [notifyUserInput]);
  useErrorFixNotice({ sessionId, xtermRef });

  const writeInput = useCallback((data: string) => {
    ptyService.write(sessionId, data).catch(console.error);
  }, [ptyService, sessionId]);

  const { isDragOver, dropHandlers } = useTerminalDrop({
    enabled: connectedRef.current,
    shellPath,
    onWriteInput: writeInput,
  });

  // Wire up OSC 633 callback after terminal is ready
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }

    const term = xtermRef.current;
    if (!term) {
      return;
    }

    const disposable = term.parser.registerOscHandler(633, (data: string) => {
      onOsc633(data);
      if (data.startsWith('P;Cwd=')) {
        const cwd = data.slice(6);
        cwdRef.current = cwd;
        lastCwdService.setLastCwd(cwd);
      }
      return false;
    });

    return () => disposable.dispose();
  }, [globalAppearance.isReady, xtermRef, onOsc633, lastCwdService]);

  // Wire up XTVERSION (CSI > q) response after terminal is ready
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }

    const term = xtermRef.current;
    if (!term) {
      return;
    }

    const disposable = term.parser.registerCsiHandler(
      { prefix: '>', final: 'q' },
      (params) => {
        // XTVERSION: only respond when param is 0 (default) per spec
        const param = typeof params[0] === 'number' ? params[0] : 0;
        if (param !== 0) {
          return false;
        }

        ptyService.write(sessionId, formatXtVersionResponse('Teal', '0.0.0')).catch(console.error);
        return true;
      }
    );

    return () => disposable.dispose();
  }, [globalAppearance.isReady, xtermRef, ptyService, sessionId]);

  // Register serializer for persistence
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }

    const disposable = persistenceService.registerSerializer(sessionId, () => {
      const result = serialize();
      if (!result) {
        return null;
      }
      return { ...result, cwd: cwdRef.current || undefined };
    });
    return () => disposable.dispose();
  }, [globalAppearance.isReady, sessionId, persistenceService, serialize]);

  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }

    let dataSub: { unsubscribe(): void } | null = null;
    let statusSub: { unsubscribe(): void } | null = null;
    let closeTabTimeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // Restore persisted buffer if available
    const restoreData = persistenceService.getRestoreData(sessionId);
    if (restoreData) {
      write(restoreData.serializedBuffer);
      write('\r\n\x1B[2m--- Session restored ---\x1B[0m\r\n\r\n');
      persistenceService.consumeRestoreData(sessionId);
    }

    const init = async () => {
      try {
        fit();

        if (disposed) {
          return;
        }

        connectedRef.current = true;
        terminalUIService.updateSessionStatus(sessionId, 'ready');

        // Initial fit() fires before onResize listener is registered — sync dimensions explicitly
        const { cols, rows } = getSize();
        ptyService.resize(sessionId, rows, cols);

        // Best-effort shell path detection for drag-and-drop path escaping
        ptyService.getShellPath(sessionId).then((sp) => {
          if (!disposed) {
            setShellPath(sp);
          }
        }).catch(() => {});

        dataSub = ptyService.data$(sessionId).subscribe({
          next: (chunk) => write(chunk.data, chunk.acknowledge),
          error: (err) => {
            console.error('[LocalTerminal] Data error:', err);
            terminalUIService.updateSessionStatus(sessionId, 'error');
          },
        });

        statusSub = ptyService.status$(sessionId).subscribe((status) => {
          terminalUIService.updateSessionStatus(sessionId, status as TerminalSessionStatus);
          if (status === PTYSessionStatus.ERROR) {
            write('\r\n\x1B[31mLocal PTY backend entered error state.\x1B[0m\r\n');
          }
          if (status === PTYSessionStatus.CLOSED || status === PTYSessionStatus.ERROR) {
            connectedRef.current = false;
          }
          // Auto-close tab when PTY process exits (e.g. user types `exit`)
          if (status === PTYSessionStatus.CLOSED) {
            if (closeTabTimeout) {
              clearTimeout(closeTabTimeout);
            }
            closeTabTimeout = setTimeout(() => {
              if (!disposed) {
                terminalUIService.removeSession(sessionId);
              }
            }, 200);
          }
        });
      } catch (err) {
        if (disposed) {
          return;
        }
        console.error('[LocalTerminal] Failed to create session:', err);
        terminalUIService.updateSessionStatus(sessionId, 'error');
        const message = err instanceof Error ? err.message : String(err);
        write(`\r\n\x1B[31mFailed to open local terminal: ${message}\x1B[0m\r\n`);
      }
    };

    init();

    return () => {
      disposed = true;
      const wasConnected = connectedRef.current;
      connectedRef.current = false;
      if (closeTabTimeout) {
        clearTimeout(closeTabTimeout);
      }
      dataSub?.unsubscribe();
      statusSub?.unsubscribe();
      if (wasConnected) {
        ptyService.closeSession(sessionId).catch(console.error);
      }
    };
  }, [globalAppearance.isReady, sessionId, ptyService, write, fit, getSize, terminalUIService, persistenceService]);

  return (
    <div ref={terminalScopeRef} className="tm:relative tm:size-full" {...dropHandlers}>
      <div
        ref={terminalRef}
        className="tm-terminal-view tm:size-full tm:overflow-hidden tm:bg-black"
      />
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
      <TerminalDropOverlay visible={isDragOver} />
    </div>
  );
}
