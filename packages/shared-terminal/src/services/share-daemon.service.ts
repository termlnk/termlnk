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

import type { ISharedKey } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side bridge between PtyMultiplexer and the relay transport.
 *
 * Implementation lives in `shared-terminal-core`; this contract sits in the
 * shared package so PairingService (which mints invites + derives per-invite
 * sharedKey) can talk to it via DI without a hard module dependency.
 *
 * Architecture:
 *   - One transport instance per attached sessionId. The relay protocol couples
 *     a WebSocket to a single sessionId (`?mode=daemon&sessionId=...`).
 *   - Subscribes to `mux.outbound$` filtered by sessionId and forwards each frame
 *     to its transport's encrypted send. The transport's current key is kept in
 *     sync with `mux.sessionKey$(sessionId)` so daemon → joiner traffic always
 *     uses the same key the joiner has been rekey'd onto.
 *   - Subscribes to transport.frames$ and routes inbound frames into mux.
 *     Special-cases the `client_join` control frame to call mux.attachClient
 *     with the joiner's X25519 pubkey, which in turn triggers mux's
 *     wrap-and-broadcast rekey flow.
 *
 * MVP scope: assumes ONE active invite per session — the `sharedKey` passed in
 * is used as the initial transport encryption key, before mux generates the
 * symmetric sessionKey. Multi-invite sessions would require a candidate-key
 * decryption loop and a richer wire protocol; left for future work.
 */
export interface IShareDaemonService {
  /**
   * Open a daemon-mode relay socket for this session if not already open.
   * Idempotent: a second call for the same sessionId is a no-op.
   */
  attachSession(sessionId: string, sharedKey: ISharedKey): Promise<void>;

  /**
   * Tear down the daemon-mode socket + subscriptions for this session.
   * Idempotent.
   */
  detachSession(sessionId: string): Promise<void>;

  /** Whether this session currently has an active daemon transport. */
  isAttached(sessionId: string): boolean;

  /**
   * Register an additional candidate sharedKey for an existing daemon-attached
   * session. Used when the owner creates a second (or later) invite for the
   * same shared session — joiners using that new invite encrypt their
   * `client_join` control frame with the new ECDH sharedKey, and the daemon
   * needs to try this key when decrypting inbound frames. Idempotent on
   * (sessionId, inviteId).
   *
   * MUST be invoked BEFORE the invite URL is exposed to any potential joiner,
   * otherwise a fast joiner could race and arrive with a frame the daemon
   * can't decrypt.
   */
  registerCandidateKey(sessionId: string, inviteId: string, sharedKey: ISharedKey): void;

  /** Remove a candidate sharedKey on invite revoke / consume / expire. */
  removeCandidateKey(sessionId: string, inviteId: string): void;

  /**
   * Broadcast a session_metadata SessionEvent to every attached client of the
   * session. Used by ShareSessionService to push the owner's displayName +
   * latest visible title; joiners apply it as their tab title. No-op when the
   * session isn't attached (we don't buffer — every attach starts with an
   * implicit push from the caller).
   *
   * Pass `null` for `ownerLabel` / `title` to explicitly clear a previously
   * sent value (e.g. owner signs out). An `undefined` field means "no change
   * to this field" — the daemon's cache merge preserves the previous value.
   */
  pushSessionMetadata(sessionId: string, metadata: { ownerLabel?: string | null; title?: string | null }): void;
}

export const IShareDaemonService = createIdentifier<IShareDaemonService>(
  'shared-terminal.share-daemon-service'
);
