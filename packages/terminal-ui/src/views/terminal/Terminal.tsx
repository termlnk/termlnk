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

import type { IHost } from '@termlnk/terminal';
import type { ITerminalViewProps } from '../../services/terminal/terminal-view-registry.service';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { IFileTransferClientService, IHostManagerService, ISSHService } from '@termlnk/rpc-client';
import { HostType, IShellIntegrationService } from '@termlnk/terminal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalInputService } from '../../services/terminal-input/terminal-input.service';
import { ITerminalPersistenceService } from '../../services/terminal/terminal-persistence.service';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { useGlobalTerminalAppearance, useSubscriptionManager, useXterm, XTERM_PROGRESS_STATE } from '../hooks';
import { useOscNotification } from '../use-osc-notification';
import { useShellIntegration } from '../use-shell-integration';
import { FileTransferOverlay } from './FileTransferOverlay';
import { SSHConnectionOverlay } from './SSHConnectionOverlay';
import { TerminalDropOverlay } from './TerminalDropOverlay';
import { TerminalProgressOverlay } from './TerminalProgressOverlay';
import { TerminalSearch } from './TerminalSearch';
import { useFileTransfer } from './use-file-transfer';
import { useSSHConnection } from './use-ssh-connection';
import { useTerminalDrop } from './use-terminal-drop';
import { useTerminalSearch } from './use-terminal-search';

export function TerminalView(props: ITerminalViewProps) {
  const { sessionId, hostId, hostName, theme, allowTransparency } = props;
  const localeService = useDependency(LocaleService);
  const sshService = useDependency(ISSHService);
  const hostManagerService = useDependency(IHostManagerService);
  const terminalUIService = useDependency(ITerminalUIService);
  const fileTransferService = useDependency(IFileTransferClientService);
  const terminalInputService = useDependency(ITerminalInputService);
  const globalAppearance = useGlobalTerminalAppearance();
  const activeSessionId = useObservable(terminalUIService.activeSessionId$, null);
  const connectedRef = useRef(false);
  const passwordOverrideRef = useRef<string | null>(null);
  const terminalScopeRef = useRef<HTMLDivElement>(null);
  const [hostInfo, setHostInfo] = useState<IHost | null>(null);
  const [hostLoaded, setHostLoaded] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);

  const hostLabel = hostInfo?.label ?? hostName;
  const hostAddress = hostInfo?.addr ? `${hostInfo.addr}:${hostInfo.port || 22}` : '';

  const subscriptions = useSubscriptionManager();

  const persistenceService = useDependency(ITerminalPersistenceService);

  const { terminalRef, xtermRef, write, fit, focus, getSize, serialize, findNext, findPrevious, clearSearchDecorations, searchResult, progressState } = useXterm({
    enabled: globalAppearance.isReady,
    onData: useCallback((data: string) => {
      if (connectedRef.current) {
        sshService.write(sessionId, data).catch(console.error);
      }
    }, [sshService, sessionId]),
    onResize: useCallback((rows: number, cols: number) => {
      if (connectedRef.current) {
        sshService.resize(sessionId, rows, cols).catch(console.error);
      }
    }, [sshService, sessionId]),
    shouldFocusOnOpen: activeSessionId === sessionId,
    theme,
    fontFamily: hostInfo?.settings?.fontFamily || globalAppearance.fontFamily,
    fontSize: hostInfo?.settings?.fontSize || globalAppearance.fontSize,
    letterSpacing: globalAppearance.letterSpacing,
    cursorStyle: globalAppearance.cursorStyle,
    cursorBlink: globalAppearance.cursorBlink,
    rendererEngine: globalAppearance.rendererEngine,
    allowTransparency,
    ctrlOrMetaOpenTerminalLink: globalAppearance.ctrlOrMetaOpenTerminalLink,
    terminalInputService,
  });

  useOscNotification({
    sessionId,
    xtermRef,
    enabled: globalAppearance.isReady,
  });

  const shellIntegrationService = useDependency(IShellIntegrationService);
  const { onOsc633 } = useShellIntegration({
    sessionId,
    xtermRef,
    shellIntegrationService,
  });

  // Wire up OSC 633 handler so shell integration events (emitted by the
  // remote shell after the main-process injector succeeds) flow into the
  // renderer-side CommandTracker, keeping SSH behavior consistent with local PTYs.
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
      return false;
    });
    return () => disposable.dispose();
  }, [globalAppearance.isReady, xtermRef, onOsc633]);

  // Register serializer for persistence
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }

    const disposable = persistenceService.registerSerializer(sessionId, () => serialize());
    return () => disposable.dispose();
  }, [globalAppearance.isReady, sessionId, persistenceService, serialize]);

  const connection = useSSHConnection({
    sessionId,
    hostId,
    sshService,
    terminalUIService,
    subscriptions,
    connectedRef,
    onData: write,
    fit,
    getSize,
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

  const { transferEvent, cancelTransfer } = useFileTransfer({
    backendSessionId: sessionId,
    fileTransferService,
  });

  const writeInput = useCallback((data: string) => {
    sshService.write(sessionId, data).catch(console.error);
  }, [sshService, sessionId]);

  const { isDragOver, dropHandlers } = useTerminalDrop({
    enabled: connection.status === 'ready',
    shellPath: null,
    onWriteInput: writeInput,
  });

  // Load host info
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }
    let disposed = false;

    hostManagerService.getInfo(hostId)
      .then((host) => {
        if (disposed) {
          return;
        }
        setHostLoaded(true);
        if (host?.type === HostType.HOST) {
          const normalized = host as IHost;
          setHostInfo(normalized);
          const needsPassword = normalized.credential?.type === 'password' && !normalized.credential.password;
          setRequiresPassword(needsPassword);
        }
      })
      .catch((err) => {
        console.error('[Terminal] Failed to load host info:', err);
        setHostLoaded(true);
      });

    return () => {
      disposed = true;
    };
  }, [globalAppearance.isReady, hostId, hostManagerService]);

  // Attach to existing backend session (created by command layer)
  useEffect(() => {
    if (!globalAppearance.isReady) {
      return;
    }
    if (connection.connectRequestedRef.current) {
      return;
    }

    connection.attachToExisting(sessionId);
  }, [globalAppearance.isReady, connection.attachToExisting, sessionId]);

  const keyboardPromptEvent = connection.pendingEvent?.type === 'keyboard_interactive'
    ? connection.pendingEvent
    : null;
  const hasKeyboardPrompt = keyboardPromptEvent !== null;

  const handlePasswordSubmit = useCallback(async (password: string, shouldSavePassword: boolean) => {
    passwordOverrideRef.current = password;

    if (keyboardPromptEvent) {
      const responses = keyboardPromptEvent.prompts.map(() => password);
      await connection.respondKeyboardInteractive(responses);
      return;
    }

    if (shouldSavePassword && hostInfo) {
      const updatedHost: IHost = {
        ...hostInfo,
        credential: {
          ...hostInfo.credential,
          type: 'password',
          password,
        },
      };
      try {
        await hostManagerService.update(updatedHost);
        setHostInfo(updatedHost);
      } catch (err) {
        console.error('[Terminal] Failed to save password:', err);
      }
    }

    // If auth_failed, retry on same session
    if (connection.status === 'auth_failed') {
      await connection.retry(password);
      return;
    }

    // First-time password entry — session already created, just retry with password
    setRequiresPassword(false);
    await connection.retry(password);
  }, [keyboardPromptEvent, connection, hostInfo, hostManagerService]);

  const handleClose = useCallback(() => {
    terminalUIService.removeSession(sessionId);
    connection.disconnect();
  }, [sessionId, terminalUIService, connection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connection.disconnect();
    };
  }, [connection.disconnect]);

  const showConnectionPanel = requiresPassword || connection.status !== 'ready';

  const overlayMode = useMemo(() => {
    if (hasKeyboardPrompt) return 'password';
    if (requiresPassword && !connection.connectRequestedRef.current) return 'password';
    if (connection.status === 'auth_failed') return 'password';
    if (connection.status === 'error' || connection.status === 'closed') return 'error';
    return 'progress';
  }, [hasKeyboardPrompt, requiresPassword, connection.status]);

  const statusText = useMemo(() => {
    if (hasKeyboardPrompt) {
      const prompt = keyboardPromptEvent?.prompts[0]?.prompt;
      const instruction = keyboardPromptEvent?.instructions;
      return instruction || prompt || localeService.t('terminal-ui.connection.status.auth');
    }
    if (overlayMode === 'password' && connection.status !== 'auth_failed') {
      return localeService.t('terminal-ui.connection.status.auth');
    }
    if (connection.status === 'auth_failed') {
      return connection.error || localeService.t('terminal-ui.connection.status.authFailed');
    }
    if (connection.status === 'error' || connection.status === 'closed') {
      return connection.error
        ? `${localeService.t('terminal-ui.connection.status.error')}: ${connection.error}`
        : localeService.t('terminal-ui.connection.status.error');
    }
    if (connection.status === 'authenticating') {
      return localeService.t('terminal-ui.connection.status.authenticating');
    }
    if (connection.status === 'opening_shell') {
      return localeService.t('terminal-ui.connection.status.openingShell');
    }
    return localeService.t('terminal-ui.connection.status.connecting');
  }, [hasKeyboardPrompt, keyboardPromptEvent, connection.error, localeService, overlayMode, connection.status]);

  return (
    <div ref={terminalScopeRef} className="tm:flex tm:size-full tm:flex-col tm:overflow-hidden">
      <div className="tm:relative tm:flex-1 tm:overflow-hidden" {...dropHandlers}>
        <div
          ref={terminalRef}
          className={cn(
            'tm-terminal-view tm:absolute tm:inset-0 tm:size-full tm:overflow-hidden tm:bg-black',
            showConnectionPanel && 'tm:pointer-events-none tm:opacity-0'
          )}
        />
        {showConnectionPanel && (
          <div className="tm:relative tm:z-10 tm:flex tm:size-full tm:items-center tm:justify-center tm:p-6">
            <SSHConnectionOverlay
              hostName={hostLabel}
              hostAddress={hostAddress}
              mode={overlayMode}
              sessionStatus={connection.status}
              statusText={statusText}
              onClose={handleClose}
              onPasswordSubmit={handlePasswordSubmit}
            />
          </div>
        )}
        {transferEvent && (
          <FileTransferOverlay event={transferEvent} onCancel={cancelTransfer} />
        )}
        {!showConnectionPanel && progressState.state !== XTERM_PROGRESS_STATE.NONE && (
          <TerminalProgressOverlay
            progress={progressState}
            className={transferEvent ? 'tm:bottom-28' : undefined}
          />
        )}
        {!showConnectionPanel && (
          <TerminalSearch
            isOpen={isSearchOpen}
            isActive={isSessionActive}
            resultCount={searchResult.resultCount}
            theme={theme}
            onClose={closeSearch}
            onSearch={handleSearch}
            onClearSearch={clearSearchDecorations}
          />
        )}
        <TerminalDropOverlay visible={isDragOver} />
      </div>
    </div>
  );
}
