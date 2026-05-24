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

import type { Observable } from 'rxjs';
import type { ClientConnectionState } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/** Frame payload as seen by the renderer-side RemoteTerminalView. */
export interface IParticipantFrame {
  /** 1 = PtyData / 0 = Control / 2 = SessionEvent (mirrors FrameChannel enum). */
  readonly channel: number;
  /** base64-encoded raw bytes for PtyData; UTF-8 JSON for Control / SessionEvent. */
  readonly payloadBase64: string;
  /** Sequence number, monotonic per channel. */
  readonly seq: number;
}

/** Snapshot delivered immediately after attach. */
export interface IParticipantSnapshot {
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
  readonly serialized: string;
  readonly observedSeq: number;
}

/** Owner-pushed metadata for a joined session: live title + display name. */
export interface IParticipantSessionMetadata {
  readonly ownerLabel?: string;
  readonly title?: string;
}

export interface IParticipantConnectInput {
  readonly inviteUrl: string;
}

export interface IParticipantConnectResult {
  readonly sessionId: string;
  readonly connectionId: string;
  readonly snapshot?: IParticipantSnapshot;
}

/**
 * Owner-process service that drives the joiner side of a multiplayer session.
 *
 * Multi-session: the joiner can hold N concurrent attachments at once. Every
 * stream below is per-session and lazily returns an empty Observable when the
 * sessionId is unknown — callers don't have to gate on `sessions$` first.
 *
 * Renderer triggers `connect(inviteUrl)`; the implementation parses the invite,
 * negotiates the session key with the relay, and starts streaming inbound frames.
 * The `frames$(sessionId)` stream is consumed by the renderer's RemoteTerminalView
 * for the corresponding tab.
 */
export interface IParticipantService {
  /** SessionIds of every active attachment. Emits on add/remove. */
  readonly sessions$: Observable<readonly string[]>;
  /** Snapshot of the current sessions list. */
  getSessions(): readonly string[];

  state$(sessionId: string): Observable<ClientConnectionState>;
  frames$(sessionId: string): Observable<IParticipantFrame>;
  snapshot$(sessionId: string): Observable<IParticipantSnapshot | null>;
  lastError$(sessionId: string): Observable<string | null>;
  /** Server-assigned connectionId for the attachment, or null while pending. */
  connectionId$(sessionId: string): Observable<string | null>;
  /** Owner-pushed metadata (label + live title) for the attachment. */
  metadata$(sessionId: string): Observable<IParticipantSessionMetadata | null>;

  connect(input: IParticipantConnectInput): Promise<IParticipantConnectResult>;
  disconnect(sessionId: string): Promise<void>;

  /**
   * Forward joiner keystrokes upstream to the owner's PTY. Encrypts a PtyData
   * frame with the current session key and routes it `target: 'daemon'` through
   * the relay. The owner's PtyMultiplexer writes the bytes to its source PTY
   * only when the joiner is the current driver (read-only joiners are silently
   * dropped server-side).
   */
  sendInput(sessionId: string, data: Uint8Array): Promise<void>;

  /**
   * Send a JSON-encoded Control message (driver_request, driver_release,
   * resize, heartbeat, ...) to the daemon. Used by the renderer's
   * RemoteTerminalView for driver arbitration.
   */
  sendControl(sessionId: string, message: object): Promise<void>;
}

export const IParticipantService = createIdentifier<IParticipantService>(
  'shared-terminal.participant-client-service'
);
