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

import type { IDaemonKeypairService, ISharedTerminalCryptoService, RekeyReason } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Optional } from '@termlnk/core';
import { IDaemonKeypairService as IDaemonKeypairServiceId, ISharedTerminalCryptoService as ISharedTerminalCryptoServiceId } from '@termlnk/shared-terminal';
import { BehaviorSubject } from 'rxjs';
import { bytesToBase64Url } from '../utils/encoding';

/** Per-recipient wrap result + the unicast control payload to push to that client. */
export interface ISessionKeyWrap {
  readonly clientId: string;
  readonly wrappedKey: Uint8Array;
  readonly senderPublicKey: Uint8Array;
  readonly reason: RekeyReason;
}

/** Aggregate result of a rotate/broadcast cycle. */
export interface ISessionKeyBroadcast {
  readonly sessionId: string;
  readonly reason: RekeyReason;
  readonly wraps: readonly ISessionKeyWrap[];
  readonly unwrappedClientIds: readonly string[];
}

/**
 * Session-key lifecycle owner — separated from PtyMultiplexer so the encryption
 * concern is independent of fanout routing.
 *
 * Each session has:
 *  - a current 32-byte symmetric key (lazy-generated on first keyed attach)
 *  - a `key$` BehaviorSubject so daemon-side bridges can swap their transport
 *    encryption key in lock-step with rotations
 *
 * The class is also responsible for wrapping the key per-recipient via NaCl box
 * using the daemon long-term keypair; callers (the mux) take the resulting
 * wraps and turn them into outbound Control frames so the wire ordering stays
 * under fanout control.
 *
 * Ordering contract preserved from the legacy mux: `key$` emits AFTER the
 * caller has flushed the wrapped-rekey control frames under the OLD key —
 * `rotate()` returns the wraps without touching `key$`; only `commitRotation()`
 * publishes the new key. PtyMultiplexer enforces that order.
 */
export class SessionKeyService extends Disposable {
  private readonly _keys = new Map<string, Uint8Array>();
  private readonly _keySubjects = new Map<string, BehaviorSubject<Uint8Array | null>>();

  constructor(
    @ISharedTerminalCryptoServiceId private readonly _crypto: ISharedTerminalCryptoService,
    @ILogService private readonly _logService: ILogService,
    @Optional(IDaemonKeypairServiceId) private readonly _daemonKeypair?: IDaemonKeypairService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    for (const [, subject] of this._keySubjects) {
      subject.next(null);
      subject.complete();
    }
    this._keySubjects.clear();
    this._keys.clear();
  }

  /** Whether the daemon keypair is registered. Without it, no rekey can happen. */
  isAvailable(): boolean {
    return this._daemonKeypair !== undefined;
  }

  getKey(sessionId: string): Uint8Array | null {
    return this._keys.get(sessionId) ?? null;
  }

  key$(sessionId: string): Observable<Uint8Array | null> {
    return this._getOrCreateSubject(sessionId).asObservable();
  }

  /**
   * Ensure the session is registered (allocate the key subject so subscribers
   * who land BEFORE the first key generation still receive the eventual key).
   */
  registerSession(sessionId: string): void {
    this._getOrCreateSubject(sessionId);
  }

  /**
   * Tear down a session — completes its key subject and clears the cached key.
   */
  unregisterSession(sessionId: string): void {
    const subject = this._keySubjects.get(sessionId);
    if (subject) {
      subject.next(null);
      subject.complete();
      this._keySubjects.delete(sessionId);
    }
    this._keys.delete(sessionId);
  }

  /**
   * Rotate the session key and produce wraps for every recipient with a
   * registered publicKey. Does NOT publish the new key on `key$`; the caller
   * (mux) must call `commitRotation` once the wrapped frames are queued under
   * the old key, otherwise joiners can never decrypt the rekey frame.
   *
   * Recipients are passed in as `(clientId, publicKey)` tuples; null/missing
   * publicKey are reported back in `unwrappedClientIds`.
   */
  async rotate(
    sessionId: string,
    recipients: Iterable<{ clientId: string; publicKey: Uint8Array | null }>,
    reason: RekeyReason
  ): Promise<ISessionKeyBroadcast> {
    if (!this._daemonKeypair) {
      return {
        sessionId,
        reason,
        wraps: [],
        unwrappedClientIds: [...recipients].map((r) => r.clientId),
      };
    }

    const newKey = this._crypto.generateSessionKey();
    this._keys.set(sessionId, newKey);
    const daemon = await this._daemonKeypair.getOrCreate();
    const wraps: ISessionKeyWrap[] = [];
    const unwrappedClientIds: string[] = [];
    for (const { clientId, publicKey } of recipients) {
      if (!publicKey) {
        unwrappedClientIds.push(clientId);
        continue;
      }
      const wrapped = this._crypto.wrapSessionKey(newKey, publicKey, daemon.secretKey);
      wraps.push({ clientId, wrappedKey: wrapped, senderPublicKey: daemon.publicKey, reason });
    }
    return { sessionId, reason, wraps, unwrappedClientIds };
  }

  /**
   * Wrap the EXISTING key for a single newly-attached client. Used when a
   * second (or later) joiner attaches mid-session: the key hasn't rotated, so
   * existing clients don't need to be re-notified, but the newcomer needs a
   * wrapped copy to decrypt subsequent broadcasts. Caller is responsible for
   * pushing the unicast control frame.
   */
  async wrapForClient(
    sessionId: string,
    clientId: string,
    publicKey: Uint8Array,
    reason: RekeyReason
  ): Promise<ISessionKeyWrap | null> {
    if (!this._daemonKeypair) {
      return null;
    }
    const key = this._keys.get(sessionId);
    if (!key) {
      return null;
    }
    const daemon = await this._daemonKeypair.getOrCreate();
    const wrapped = this._crypto.wrapSessionKey(key, publicKey, daemon.secretKey);
    return { clientId, wrappedKey: wrapped, senderPublicKey: daemon.publicKey, reason };
  }

  /** Publish the freshly-rotated key. Callers MUST have flushed wrap frames first. */
  commitRotation(sessionId: string): void {
    const key = this._keys.get(sessionId);
    if (!key) {
      return;
    }
    this._getOrCreateSubject(sessionId).next(key);
  }

  /** Drop the cached key (e.g. last keyed participant left) and notify. */
  clear(sessionId: string): void {
    this._keys.delete(sessionId);
    this._keySubjects.get(sessionId)?.next(null);
  }

  /** Encode a wrap for JSON delivery as a Control message. */
  static toControlPayload(wrap: ISessionKeyWrap): Record<string, unknown> {
    return {
      type: 'rekey',
      wrappedKey: bytesToBase64Url(wrap.wrappedKey),
      senderPublicKey: bytesToBase64Url(wrap.senderPublicKey),
      reason: wrap.reason,
    };
  }

  private _getOrCreateSubject(sessionId: string): BehaviorSubject<Uint8Array | null> {
    let subject = this._keySubjects.get(sessionId);
    if (!subject) {
      subject = new BehaviorSubject<Uint8Array | null>(null);
      this._keySubjects.set(sessionId, subject);
    }
    return subject;
  }
}
