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

import type { SSHSessionEvent } from '@termlnk/rpc';
import type { ISSHService } from '@termlnk/rpc-client';
import type { RefObject } from 'react';
import type { ITerminalUIService, TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import type { useSubscriptionManager } from '../hooks';
import { SSHSessionStatus } from '@termlnk/rpc';
import { useCallback, useRef, useState } from 'react';

const sshStatusToTerminalStatus = (status: SSHSessionStatus): TerminalSessionStatus => status as TerminalSessionStatus;

export interface IUseSSHConnectionOptions {
  sessionId: string;
  hostId: string;
  sshService: ISSHService;
  terminalUIService: ITerminalUIService;
  subscriptions: ReturnType<typeof useSubscriptionManager>;
  connectedRef: RefObject<boolean>;
  onData: (data: string) => void;
  fit: () => void;
  getSize: () => { cols: number; rows: number };
}

export function useSSHConnection(options: IUseSSHConnectionOptions) {
  const {
    sessionId,
    sshService,
    terminalUIService,
    subscriptions,
    connectedRef,
    onData,
    fit,
    getSize,
  } = options;

  const connectRequestedRef = useRef(false);
  const dataReadyRef = useRef(false);

  const [error, setError] = useState('');
  const [status, setStatus] = useState<TerminalSessionStatus>('connecting');
  const [pendingEvent, setPendingEvent] = useState<SSHSessionEvent | null>(null);

  const subscribeToSession = useCallback((backendId: string) => {
    subscriptions.setSub('status', sshService.status$(backendId).subscribe((s) => {
      const mapped = sshStatusToTerminalStatus(s);
      setStatus(mapped);
      terminalUIService.updateSessionStatus(sessionId, mapped);
      if (s === SSHSessionStatus.CLOSED || s === SSHSessionStatus.ERROR || s === SSHSessionStatus.AUTH_FAILED) {
        connectedRef.current = false;
      }
    }));

    subscriptions.setSub('event', sshService.event$(backendId).subscribe((event) => {
      if (event.type === 'log') {
        return;
      }
      if (event.type === 'keyboard_interactive' || event.type === 'change_password') {
        setPendingEvent(event);
      }
      if (event.type === 'banner') {
        onData(`\r\n${event.message}\r\n`);
      }
    }));

    subscriptions.setSub('error', sshService.error$(backendId).subscribe((err) => {
      if (err) {
        setError(err);
        setStatus('error');
        onData(`\r\n\x1B[31m${err}\x1B[0m\r\n`);
      }
    }));

    subscriptions.setSub('output', sshService.data$(backendId).subscribe((data) => {
      if (data.length === 0) {
        return;
      }
      if (!dataReadyRef.current) {
        dataReadyRef.current = true;
        setStatus('ready');
        terminalUIService.updateSessionStatus(sessionId, 'ready');
      }
      onData(data);
    }));
  }, [sshService, terminalUIService, sessionId, subscriptions, connectedRef, onData]);

  const retry = useCallback(async (password: string) => {
    dataReadyRef.current = false;
    setError('');
    setPendingEvent(null);
    setStatus('connecting');
    try {
      await sshService.retrySession(sessionId, password);
    } catch (err) {
      console.error('[Terminal] Retry failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [sshService, sessionId]);

  const respondKeyboardInteractive = useCallback(async (responses: string[]) => {
    try {
      await sshService.respondKeyboardInteractive(sessionId, responses);
      setPendingEvent(null);
    } catch (err) {
      console.error('[Terminal] Keyboard-interactive response failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [sshService, sessionId]);

  const disconnect = useCallback(() => {
    connectedRef.current = false;
    subscriptions.unsubscribeAll();
    sshService.closeSession(sessionId).catch(console.error);
  }, [sshService, sessionId, connectedRef, subscriptions]);

  const attachToExisting = useCallback((backendId: string) => {
    if (connectRequestedRef.current) {
      return;
    }
    connectRequestedRef.current = true;
    dataReadyRef.current = false;
    setError('');
    setPendingEvent(null);
    setStatus('connecting');

    connectedRef.current = true;
    subscribeToSession(backendId);

    // Initial fit() fires before onResize listener is registered — sync dimensions explicitly
    const { cols, rows } = getSize();
    sshService.resize(backendId, rows, cols).catch(console.error);

    setTimeout(fit, 100);
  }, [fit, getSize, sshService, subscribeToSession, connectedRef]);

  return {
    status,
    error,
    pendingEvent,
    connectRequestedRef,
    retry,
    respondKeyboardInteractive,
    disconnect,
    attachToExisting,
  };
}
