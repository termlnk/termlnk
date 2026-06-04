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

import type { SSHHopProgressStatus, SSHSessionEvent } from '@termlnk/rpc';
import type { ISSHService } from '@termlnk/rpc-client';
import type { RefObject } from 'react';
import type { ITerminalUIService, TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import type { useSubscriptionManager } from '../hooks';
import { SSHSessionStatus } from '@termlnk/rpc';
import { useCallback, useRef, useState } from 'react';

export interface IHopState {
  hopId: string;
  hopLabel: string;
  hopIndex: number;
  hopCount: number;
  status: SSHHopProgressStatus;
  message?: string;
}

const sshStatusToTerminalStatus = (status: SSHSessionStatus): TerminalSessionStatus => status as TerminalSessionStatus;

export interface IUseSSHConnectionOptions {
  sessionId: string;
  hostId: string;
  sshService: ISSHService;
  terminalUIService: ITerminalUIService;
  subscriptions: ReturnType<typeof useSubscriptionManager>;
  connectedRef: RefObject<boolean>;
  onData: (data: string) => void;
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
    getSize,
  } = options;

  const connectRequestedRef = useRef(false);
  const dataReadyRef = useRef(false);

  const [error, setError] = useState('');
  const [status, setStatus] = useState<TerminalSessionStatus>('connecting');
  const [pendingEvent, setPendingEvent] = useState<SSHSessionEvent | null>(null);
  const [hopStates, setHopStates] = useState<IHopState[]>([]);

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
      if (event.type === 'keyboard_interactive' || event.type === 'change_password' || event.type === 'host_key_verify') {
        setPendingEvent(event);
      }
      if (event.type === 'banner') {
        onData(`\r\n${event.message}\r\n`);
      }
      if (event.type === 'hop_progress') {
        setHopStates((prev) => {
          const next = prev.filter((h) => h.hopId !== event.hopId);
          next.push({
            hopId: event.hopId,
            hopLabel: event.hopLabel,
            hopIndex: event.hopIndex,
            hopCount: event.hopCount,
            status: event.status,
            message: event.message,
          });
          return next.sort((a, b) => a.hopIndex - b.hopIndex);
        });
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
    setHopStates([]);
    setStatus('connecting');
    try {
      await sshService.retrySession(sessionId, password);
    } catch (err) {
      console.error('[Terminal] Retry failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [sshService, sessionId]);

  const respondKeyboardInteractive = useCallback(async (responses: string[], viaHopId?: string) => {
    try {
      await sshService.respondKeyboardInteractive(sessionId, responses, viaHopId);
      setPendingEvent(null);
    } catch (err) {
      console.error('[Terminal] Keyboard-interactive response failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [sshService, sessionId]);

  const respondHostKeyVerify = useCallback(async (action: 'accept_save' | 'accept_once' | 'reject') => {
    try {
      await sshService.respondHostKeyVerify(sessionId, action);
      setPendingEvent(null);
    } catch (err) {
      console.error('[Terminal] Host-key verify response failed:', err);
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
    setHopStates([]);
    setStatus('connecting');

    connectedRef.current = true;
    subscribeToSession(backendId);

    // The initial fit() (in useXterm) runs before the onResize listener is
    // wired, so its geometry never reaches the backend — push it explicitly.
    // Later font-load / container resizes re-fit and sync through onResize.
    const { cols, rows } = getSize();
    sshService.resize(backendId, rows, cols).catch(console.error);
  }, [getSize, sshService, subscribeToSession, connectedRef]);

  return {
    status,
    error,
    pendingEvent,
    hopStates,
    connectRequestedRef,
    retry,
    respondKeyboardInteractive,
    respondHostKeyVerify,
    disconnect,
    attachToExisting,
  };
}
