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

import type { IDriverState, IParticipantFrame, IParticipantSnapshot } from '@termlnk/shared-terminal';
import type { ITerminalViewProps } from '@termlnk/terminal-ui';
import type { IXtermTheme } from '@termlnk/themes';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, useDependency, useObservable } from '@termlnk/design';
import { ClientConnectionState, ISharedTerminalService } from '@termlnk/shared-terminal';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { CrownIcon, EyeIcon, KeyboardIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY } from 'rxjs';
import '@xterm/xterm/css/xterm.css';

const PTY_DATA_CHANNEL = 1;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

const FALLBACK_THEME: IXtermTheme = {
  background: '#1a1c20',
  foreground: '#c8ccd4',
  cursor: '#c8ccd4',
  cursorAccent: '#1a1c20',
  selectionBackground: '#3b4048',
  selectionForeground: '#c8ccd4',
  black: '#1a1c20',
  red: '#c84e4e',
  green: '#82c272',
  yellow: '#deb46b',
  blue: '#6a9fb5',
  magenta: '#aa759f',
  cyan: '#75b5aa',
  white: '#c8ccd4',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#dcdcdc',
};

/**
 * Joiner-side terminal view, mounted as a 'remote'-type tab by the bridge
 * controller. Each tab has its own props.sessionId — the view subscribes
 * exclusively to per-session streams (state$/frames$/snapshot$/metadata$/...)
 * so two remote tabs render independently with no cross-talk.
 *
 * Driver arbitration:
 *   - Read-only joiners (observer / non-driver co-pilot) get an `xterm` with
 *     no upstream send. The Terminal class still receives keystrokes but they
 *     are dropped server-side (mux only writes the current driver's frames
 *     into the PTY), so visually the operator just sees no reaction.
 *   - The "Request keyboard" button sends a driver_request control frame; the
 *     daemon swaps the driverId and broadcasts driver_handover which arrives
 *     via participantFrames$ on the SessionEvent channel. The button text
 *     swaps to "Release" when this client is the active driver.
 */
export function RemoteTerminalView(props: ITerminalViewProps): React.JSX.Element | null {
  const { sessionId, theme, allowTransparency } = props;
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const client = useDependency(ISharedTerminalService, Quantity.OPTIONAL);

  const stateObservable = useMemo(
    () => client?.participantState$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const connectionState = useObservable<ClientConnectionState>(stateObservable, ClientConnectionState.Idle);

  const snapshotObservable = useMemo(
    () => client?.participantSnapshot$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const snapshot = useObservable<IParticipantSnapshot | null>(snapshotObservable, null);

  const connectionIdObservable = useMemo(
    () => client?.participantConnectionId$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const myClientId = useObservable<string | null>(connectionIdObservable, null);

  const lastErrorObservable = useMemo(
    () => client?.participantLastError$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const lastError = useObservable<string | null>(lastErrorObservable, null);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  // Capture initial transparency + theme in refs so the init effect doesn't
  // depend on them (which would destroy + recreate xterm on every theme prop
  // change, wiping scrollback). The theme effect below applies new themes via
  // `term.options.theme = ...` in place.
  const allowTransparencyRef = useRef(allowTransparency);
  const initialThemeRef = useRef(theme ?? FALLBACK_THEME);
  const [driverState, setDriverState] = useState<IDriverState | null>(null);
  const isDriver = useMemo(
    () => driverState?.driverId !== null && driverState?.driverId === myClientId,
    [driverState, myClientId]
  );

  // Initialise xterm exactly once. Theme + allowTransparency are read from
  // the refs above so a re-render with a fresh theme object doesn't trigger
  // a tear-down. Theme changes flow through a separate effect.
  useEffect(() => {
    if (!containerRef.current || termRef.current) {
      return undefined;
    }
    const term = new Terminal({
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      cursorBlink: true,
      fontFamily: 'Menlo, monospace',
      fontSize: 13,
      scrollback: 5000,
      allowTransparency: allowTransparencyRef.current ?? true,
      theme: initialThemeRef.current,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    const container = containerRef.current;
    term.open(container);
    try {
      fit.fit();
    } catch (err) {
      logService.warn('[RemoteTerminalView] FitAddon.fit failed on init:', err);
    }
    termRef.current = term;
    fitRef.current = fit;

    return () => {
      term.dispose();
      // xterm.dispose() removes its event listeners but historically has
      // left stray DOM children behind under React StrictMode's
      // setup → cleanup → setup cycle. Clear the container explicitly so
      // the next mount opens onto a fresh node.
      if (container) {
        container.replaceChildren();
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [logService]);

  // Apply theme changes in-place; never recreate the terminal. Matches the
  // useXterm hook's behaviour in @termlnk/terminal-ui so a user-driven theme
  // switch preserves scrollback for shared sessions too.
  useEffect(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    term.options.theme = theme ?? FALLBACK_THEME;
  }, [theme]);

  // Hydrate the buffer from the inbound snapshot whenever it lands.
  useEffect(() => {
    if (!snapshot || !termRef.current) {
      return;
    }
    const term = termRef.current;
    try {
      term.resize(snapshot.cols, snapshot.rows);
    } catch (err) {
      logService.warn('[RemoteTerminalView] xterm.resize failed:', err);
    }
    term.reset();
    if (snapshot.serialized) {
      term.write(snapshot.serialized);
    }
  }, [snapshot, logService]);

  // Stream inbound PtyData frames into the terminal. Drop other channels —
  // SessionEvent is handled by ParticipantClientService (snapshot$/metadata$)
  // and Control by ParticipantClientService too (rekey).
  useEffect(() => {
    if (!client) {
      return undefined;
    }
    const sub = client.participantFrames$(sessionId).subscribe((frame: IParticipantFrame) => {
      if (frame.channel !== PTY_DATA_CHANNEL) {
        return;
      }
      const term = termRef.current;
      if (!term) {
        return;
      }
      term.write(base64UrlToBytes(frame.payloadBase64));
    });
    return () => sub.unsubscribe();
  }, [client, sessionId]);

  // Subscribe to driver state for this specific session.
  useEffect(() => {
    if (!client) {
      return undefined;
    }
    const sub = client.driverState$(sessionId).subscribe(setDriverState);
    return () => sub.unsubscribe();
  }, [client, sessionId]);

  // Forward keystrokes upstream when present + connected. xterm raises onData
  // for every key (including non-driver), but if we're not the driver the
  // daemon will silently drop the bytes — we still call sendInput because the
  // server-side enforcement is cheap and matches the original principle: the
  // owner's PTY is the only execution point.
  useEffect(() => {
    if (!client || !termRef.current) {
      return undefined;
    }
    const encoder = new TextEncoder();
    const disp = termRef.current.onData((data) => {
      if (connectionState !== ClientConnectionState.Connected) {
        return;
      }
      void client.sendParticipantInput(sessionId, encoder.encode(data)).catch((err) => {
        logService.warn('[RemoteTerminalView] sendParticipantInput failed:', err);
      });
    });
    return () => disp.dispose();
  }, [client, connectionState, logService, sessionId]);

  // Container resize → refit the xterm. We do NOT send a resize control frame
  // upstream — joiners must not change the owner's PTY dimensions. Instead
  // the snapshot above keeps the xterm's logical size in sync with the owner.
  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    const ro = new ResizeObserver(() => {
      try {
        fitRef.current?.fit();
      } catch (err) {
        logService.warn('[RemoteTerminalView] FitAddon.fit failed:', err);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [logService]);

  const handleRequestKeyboard = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      await client.sendParticipantControl(sessionId, { type: 'driver_request' });
    } catch (err) {
      logService.warn('[RemoteTerminalView] driver_request failed:', err);
    }
  }, [client, logService, sessionId]);

  const handleReleaseKeyboard = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      await client.sendParticipantControl(sessionId, { type: 'driver_release' });
    } catch (err) {
      logService.warn('[RemoteTerminalView] driver_release failed:', err);
    }
  }, [client, logService, sessionId]);

  if (!client) {
    return null;
  }

  return (
    <div className={cn('tm:flex tm:size-full tm:flex-col tm:gap-2 tm:p-2')}>
      <div className={cn('tm:flex tm:items-center tm:justify-between tm:gap-2 tm:text-xs tm:text-grey-fg')}>
        <div className={cn('tm:flex tm:items-center tm:gap-2')}>
          {isDriver
            ? (
              <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-yellow/15 tm:text-yellow')}>
                <CrownIcon className={cn('tm:size-3')} />
                {localeService.t('shared-terminal-ui.remote.driving')}
              </Badge>
            )
            : (
              <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-blue/10 tm:text-blue')}>
                <EyeIcon className={cn('tm:size-3')} />
                {localeService.t('shared-terminal-ui.remote.viewing-only')}
              </Badge>
            )}
          <span>{stateLabel(connectionState, localeService)}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void (isDriver ? handleReleaseKeyboard() : handleRequestKeyboard()); }}
          disabled={connectionState !== ClientConnectionState.Connected}
          className={cn('tm:gap-1.5')}
        >
          <KeyboardIcon className={cn('tm:size-3.5')} />
          {isDriver
            ? localeService.t('shared-terminal-ui.remote.release-keyboard')
            : localeService.t('shared-terminal-ui.remote.request-keyboard')}
        </Button>
      </div>
      <div
        ref={containerRef}
        className={cn('tm:min-h-0 tm:flex-1 tm:overflow-hidden tm:rounded-md tm:border tm:border-line tm:bg-black tm:p-2')}
      />
      {lastError && (
        <div className={cn('tm:rounded-md tm:border tm:border-red/40 tm:bg-red/10 tm:p-2 tm:text-xs tm:text-red')}>
          <div className={cn('tm:font-mono tm:break-all tm:text-red/80')}>{lastError}</div>
        </div>
      )}
      <div className={cn('tm:text-xs tm:text-grey-fg')}>
        {isDriver
          ? localeService.t('shared-terminal-ui.remote.driver-hint')
          : localeService.t('shared-terminal-ui.remote.read-only-hint')}
      </div>
    </div>
  );
}

function stateLabel(state: ClientConnectionState, locale: { t: (key: string) => string }): string {
  switch (state) {
    case ClientConnectionState.Pairing:
      return locale.t('shared-terminal-ui.remote.state.pairing');
    case ClientConnectionState.Connecting:
      return locale.t('shared-terminal-ui.remote.state.connecting');
    case ClientConnectionState.Connected:
      return locale.t('shared-terminal-ui.remote.state.connected');
    case ClientConnectionState.Disconnected:
      return locale.t('shared-terminal-ui.remote.state.disconnected');
    case ClientConnectionState.Error:
      return locale.t('shared-terminal-ui.remote.state.error');
    default:
      return '';
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
