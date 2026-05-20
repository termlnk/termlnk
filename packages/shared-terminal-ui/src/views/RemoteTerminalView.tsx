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

import type { IParticipantFrame, IParticipantSnapshot } from '@termlnk/shared-terminal';
import { LocaleService, Quantity } from '@termlnk/core';
import { Badge, cn, useDependency, useObservable } from '@termlnk/design';
import { ClientConnectionState, ISharedTerminalService } from '@termlnk/shared-terminal';
import { EyeIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PTY_DATA_CHANNEL = 1;
const MAX_LINES = 2000;

/**
 * Joiner-side terminal view.
 *
 * Renders inbound PtyData frames as decoded UTF-8 text. This is intentionally a
 * lightweight `<pre>` viewer rather than a full xterm.js instance — ANSI escape
 * sequences are preserved as raw text so the operator can see the wire content
 * while a future iteration wraps this in xterm proper. The terminal is wrapped
 * in ObserverReadOnlyShell so the read-only semantics are visually unambiguous.
 *
 * Lifecycle:
 *   1. SharedTerminalPanel mounts this when ParticipantJoinDialog completes a Join.
 *   2. Subscribes to client.participantSnapshot$ to hydrate the initial buffer.
 *   3. Streams client.participantFrames$ → decoded text → appended to buffer.
 *   4. Renderer caps the buffer to MAX_LINES to bound memory.
 */
export function RemoteTerminalView() {
  const localeService = useDependency(LocaleService);
  const client = useDependency(ISharedTerminalService, Quantity.OPTIONAL);
  const snapshot = useObservable<IParticipantSnapshot | null>(client?.participantSnapshot$ ?? null, null);
  const connectionState = useObservable<ClientConnectionState>(
    client?.participantState$ ?? null,
    ClientConnectionState.Idle
  );
  const [text, setText] = useState<string>('');
  const decoderRef = useRef(new TextDecoder('utf-8', { fatal: false }));

  // Snapshot replays the entire serialised terminal state — replace the buffer.
  useEffect(() => {
    if (snapshot) {
      setText(snapshot.serialized);
    }
  }, [snapshot]);

  useEffect(() => {
    if (!client) {
      return undefined;
    }
    const sub = client.participantFrames$.subscribe((frame: IParticipantFrame) => {
      if (frame.channel !== PTY_DATA_CHANNEL) {
        return;
      }
      const bytes = base64UrlToBytes(frame.payloadBase64);
      const chunk = decoderRef.current.decode(bytes, { stream: true });
      setText((prev) => trimToBuffer(prev + chunk));
    });
    return () => sub.unsubscribe();
  }, [client]);

  if (!client) {
    return null;
  }
  if (connectionState === ClientConnectionState.Idle) {
    return null;
  }

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-2')}>
      <div className={cn('tm:flex tm:items-center tm:gap-2 tm:text-xs tm:text-grey-fg')}>
        <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-blue/10 tm:text-blue')}>
          <EyeIcon className={cn('tm:size-3')} />
          {localeService.t('shared-terminal-ui.remote.viewing-only')}
        </Badge>
        <span>{stateLabel(connectionState, localeService)}</span>
      </div>
      <pre
        className={cn(`
          tm:max-h-[480px] tm:min-h-[200px] tm:overflow-auto tm:rounded-md tm:border-2 tm:border-dashed
          tm:border-blue/50 tm:bg-black tm:px-3 tm:py-2 tm:font-mono tm:text-xs tm:wrap-break-word tm:whitespace-pre
          tm:text-light-grey
        `)}
      >
        {text || localeService.t('shared-terminal-ui.remote.waiting-for-frames')}
      </pre>
      <div className={cn('tm:text-xs tm:text-grey-fg')}>
        {localeService.t('shared-terminal-ui.remote.read-only-hint')}
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

function trimToBuffer(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= MAX_LINES) {
    return text;
  }
  return lines.slice(lines.length - MAX_LINES).join('\n');
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
