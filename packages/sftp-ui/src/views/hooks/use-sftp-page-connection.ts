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

import type { SFTPSessionEvent, SFTPSessionStatus } from '@termlnk/rpc';
import { ILogService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { ISFTPService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SFTPPageConnectionPhase = 'idle' | 'connecting' | 'password' | 'ready' | 'error' | 'closed';

export type SFTPPageConnectionState =
  | { phase: 'idle' }
  | { phase: 'connecting'; status: SFTPSessionStatus }
  | { phase: 'password'; prompts: Array<{ prompt: string; echo: boolean }> }
  | { phase: 'ready'; backendSessionId: string }
  | { phase: 'error'; message: string }
  | { phase: 'closed' };

export function useSFTPPageConnection(hostId: string | null) {
  const sftpService = useDependency(ISFTPService);
  const logService = useDependency(ILogService);
  const [state, setState] = useState<SFTPPageConnectionState>({ phase: 'idle' });
  const backendSessionIdRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  const connect = useCallback(async (password?: string) => {
    if (!hostId) {
      return;
    }
    try {
      setState({ phase: 'connecting', status: 'connecting' as SFTPSessionStatus });
      const bsId = await sftpService.createSession(hostId, password);
      if (disposedRef.current) {
        sftpService.closeSession(bsId).catch((err) => logService.error(err));
        return;
      }
      backendSessionIdRef.current = bsId;

      const statusSub = sftpService.status$(bsId).subscribe((status) => {
        if (disposedRef.current) {
          return;
        }
        if (status === 'ready') {
          setState({ phase: 'ready', backendSessionId: bsId });
        } else if (status === 'closed') {
          setState({ phase: 'closed' });
        } else if (status === 'auth_failed' || status === 'error') {
          // Handled by event$
        } else {
          setState({ phase: 'connecting', status });
        }
      });

      const eventSub = sftpService.event$(bsId).subscribe((event: SFTPSessionEvent) => {
        if (disposedRef.current) {
          return;
        }
        if (event.type === 'keyboard_interactive') {
          setState({ phase: 'password', prompts: event.prompts });
        } else if (event.type === 'auth_failed') {
          setState({ phase: 'error', message: event.message });
        } else if (event.type === 'error') {
          setState({ phase: 'error', message: event.message });
        } else if (event.type === 'change_password') {
          setState({ phase: 'password', prompts: [{ prompt: event.message, echo: false }] });
        }
      });

      return () => {
        statusSub.unsubscribe();
        eventSub.unsubscribe();
      };
    } catch (err) {
      if (disposedRef.current) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: 'error', message });
    }
  }, [hostId, sftpService, logService]);
  const retry = useCallback(async (password: string) => {
    if (!backendSessionIdRef.current) {
      return;
    }
    try {
      setState({ phase: 'connecting', status: 'connecting' as SFTPSessionStatus });
      await sftpService.retrySession(backendSessionIdRef.current, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: 'error', message });
    }
  }, [sftpService]);

  const respondKeyboardInteractive = useCallback(async (responses: string[]) => {
    if (!backendSessionIdRef.current) {
      return;
    }
    setState({ phase: 'connecting', status: 'authenticating' as SFTPSessionStatus });
    await sftpService.respondKeyboardInteractive(backendSessionIdRef.current, responses);
  }, [sftpService]);

  const disconnect = useCallback(async () => {
    if (backendSessionIdRef.current) {
      await sftpService.closeSession(backendSessionIdRef.current).catch((err) => logService.error(err));
      backendSessionIdRef.current = null;
    }
    setState({ phase: 'idle' });
  }, [sftpService, logService]);

  useEffect(() => {
    if (!hostId) {
      // Disconnect old session when host changes to null
      if (backendSessionIdRef.current) {
        sftpService.closeSession(backendSessionIdRef.current).catch((err) => logService.error(err));
        backendSessionIdRef.current = null;
      }
      setState({ phase: 'idle' });
      return;
    }

    disposedRef.current = false;

    // Disconnect old session when host changes
    if (backendSessionIdRef.current) {
      sftpService.closeSession(backendSessionIdRef.current).catch((err) => logService.error(err));
      backendSessionIdRef.current = null;
    }

    const cleanupPromise = connect();

    return () => {
      disposedRef.current = true;
      cleanupPromise?.then((cleanup) => cleanup?.());
      if (backendSessionIdRef.current) {
        sftpService.closeSession(backendSessionIdRef.current).catch((err) => logService.error(err));
        backendSessionIdRef.current = null;
      }
    };
  }, [hostId, connect, sftpService, logService]);

  return {
    state,
    backendSessionId: backendSessionIdRef.current,
    retry,
    respondKeyboardInteractive,
    disconnect,
  };
}
