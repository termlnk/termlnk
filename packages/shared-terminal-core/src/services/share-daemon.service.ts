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

import type { Nullable } from '@termlnk/core';
import type { IFrame, IPtyMultiplexerService, IShareDaemonService, ISharedKey, ISharedTerminalPluginConfig, SharedTerminalRole } from '@termlnk/shared-terminal';
import type { Subscription } from 'rxjs';
import { ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService, Optional } from '@termlnk/core';
import { FrameChannel, FrameFlag, IFrameCodecService, IPtyMultiplexerService as IPtyMultiplexerServiceId, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { RelayTransportService } from './relay-transport.service';

interface IAttachedSession {
  readonly transport: RelayTransportService;
  readonly subscriptions: Subscription[];
  /**
   * Seq counter for daemon-initiated frames emitted directly through this
   * transport (errors on the Control channel, session_metadata on the
   * SessionEvent channel). This is a SEPARATE namespace from PtyMultiplexer's
   * per-runtime seq counters — mux owns its own seq stream for snapshot /
   * driver_handover / participant_* events and writes them through this same
   * transport but via mux.outbound$. Joiners therefore observe two
   * monotonically-increasing seq streams on the SessionEvent channel
   * (mux-originated and daemon-originated) that are NOT globally ordered.
   * Today the joiner does not dedupe by (channel, seq) so the namespace
   * split is benign; any future replay-protection on the joiner side must
   * scope its dedup map by emitter id rather than assuming a single seq
   * series per channel.
   */
  daemonSeq: number;
  /**
   * Candidate ECDH sharedKeys, one per active invite. `RelayTransport` calls
   * back into `_resolveKeys` and we yield every entry — the transport then
   * tries each in turn against an inbound ciphertext until one decrypts (or
   * all fail, in which case the frame is dropped). The initial invite's key
   * is seeded at attachSession time with `inviteId === '<initial>'`.
   */
  readonly candidateKeys: Map<string, ISharedKey>;
}

/**
 * ShareDaemonService — owner-side bridge between PtyMultiplexer and the relay.
 *
 * See @termlnk/shared-terminal/services/share-daemon.service for the contract +
 * architecture rationale.
 *
 * Lifecycle:
 *   PairingService.createInvite computes `sharedKey = ECDH(daemonPriv, ephPub)`
 *   and calls `attachSession(sid, sharedKey)`. This service:
 *     1. Opens a daemon-mode WebSocket to /v1/shared-terminal — uses sharedKey
 *        as the initial encryption key so it can decrypt the joiner's first
 *        `client_join` control frame (encrypted with the same sharedKey).
 *     2. On receiving client_join, calls mux.attachClient with the joiner's
 *        userPublicKey. mux generates the per-session symmetric key,
 *        wraps it via NaCl box for the joiner, and broadcasts the rekey
 *        control frame back through outbound$ — still encrypted with the OLD
 *        sharedKey because mux emits sessionKey$ only AFTER pushing the
 *        rekey frame (per ordering guarantee in pty-multiplexer.service.ts).
 *     3. When sessionKey$ emits the new key, we swap the transport's key via
 *        rekey() so subsequent PtyData uses the symmetric sessionKey.
 *     4. mux.outbound$ filtered by sessionId is forwarded to transport.send;
 *        transport.frames$ is forwarded into mux.handleInbound.
 *
 * Detach is symmetric: cancel subscriptions, disconnect transport.
 */
export class ShareDaemonService extends Disposable implements IShareDaemonService {
  private readonly _attached = new Map<string, IAttachedSession>();
  /**
   * Per-session metadata cache (ownerLabel + visible title). pushSessionMetadata
   * merges new values in and broadcasts; on client_join we unicast the cached
   * entry back to the new joiner so they don't miss a previous owner-side
   * update (the broadcast that originally fired may pre-date their attach).
   */
  private readonly _metadataCache = new Map<string, { ownerLabel?: string; title?: string }>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @IPtyMultiplexerServiceId private readonly _mux: IPtyMultiplexerService,
    @IFrameCodecService private readonly _codec: IFrameCodecService,
    @Optional(ITokenManager) private readonly _tokenManager?: ITokenManager
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    for (const sid of [...this._attached.keys()]) {
      void this.detachSession(sid).catch((err) => {
        this._logService.warn(`[ShareDaemonService] detach during dispose failed for ${sid}:`, err);
      });
    }
  }

  isAttached(sessionId: string): boolean {
    return this._attached.has(sessionId);
  }

  registerCandidateKey(sessionId: string, inviteId: string, sharedKey: ISharedKey): void {
    const att = this._attached.get(sessionId);
    if (!att) {
      // Session not yet attached — the next attachSession() call will seed
      // the initial key. We deliberately don't buffer here because we don't
      // know which sessionId belongs to which (yet-unmatched) ephPriv.
      return;
    }
    att.candidateKeys.set(inviteId, sharedKey);
  }

  removeCandidateKey(sessionId: string, inviteId: string): void {
    const att = this._attached.get(sessionId);
    if (!att) {
      return;
    }
    att.candidateKeys.delete(inviteId);
  }

  async attachSession(sessionId: string, sharedKey: ISharedKey): Promise<void> {
    if (this._attached.has(sessionId)) {
      return;
    }

    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    const relayBaseUrl = config?.relayBaseUrl?.replace(/\/+$/, '');
    if (!relayBaseUrl) {
      throw new Error('[ShareDaemonService] relayBaseUrl not configured; cannot attach session');
    }

    const accountToken = await this._tokenManager?.getAccessToken();
    if (!accountToken) {
      throw new Error('[ShareDaemonService] sign-in required before sharing a session');
    }

    const transport = new RelayTransportService(this._codec, this._logService);
    try {
      await transport.connect({
        relayBaseUrl,
        sessionId,
        accountToken,
        mode: 'daemon',
      }, sharedKey);
    } catch (err) {
      this._logService.error(`[ShareDaemonService] transport.connect failed for ${sessionId}:`, err);
      throw err;
    }

    const subscriptions: Subscription[] = [];
    const candidateKeys = new Map<string, ISharedKey>();
    // Seed the initial invite's sharedKey under a sentinel id. PairingService
    // will additionally call registerCandidateKey(inviteId, ...) for every
    // active invite; the seed is the "first invite that triggered attach" and
    // covers the race where a joiner connects before any registerCandidateKey
    // arrives.
    candidateKeys.set('<initial>', sharedKey);

    // Hook the transport's per-frame decrypt to yield every candidate. The
    // transport will additionally try its own _sessionKey after the resolver
    // is exhausted, so single-invite sessions keep working unchanged.
    transport.setKeyResolver(() => candidateKeys.values());

    // 1. mux.outbound$ → transport.send
    subscriptions.push(this._mux.outbound$.subscribe(({ sessionId: sid, target, frame }) => {
      if (sid !== sessionId) {
        return;
      }
      if (frame.channel === FrameChannel.SessionEvent) {
        const parsed = this._tryParseDebugPayload(frame.payload);
        if (parsed?.type === 'driver_handover') {
          this._logService.log(`[DRIVER-DEBUG] daemon outbound driver_handover sid=${sessionId} target=${target} from=${parsed.fromClientId} to=${parsed.toClientId}`);
        }
      }
      try {
        transport.send(frame, { target });
      } catch (err) {
        this._logService.warn(`[ShareDaemonService] transport.send failed for ${sessionId}:`, err);
      }
    }));

    // 2. mux.sessionKey$ → transport.rekey. Skip the BehaviorSubject's initial
    //    null emission (no key yet) — rekey() requires 32 bytes and is daemon-only.
    subscriptions.push(this._mux.sessionKey$(sessionId).subscribe((key) => {
      if (!key) {
        return;
      }
      void transport.rekey(key).catch((err) => {
        this._logService.warn(`[ShareDaemonService] transport.rekey failed for ${sessionId}:`, err);
      });
    }));

    // 3. transport.frames$ → mux.handleInbound (with client_join special-case)
    subscriptions.push(transport.frames$.subscribe((inbound) => {
      this._handleInboundFrame(sessionId, inbound.source, inbound.frame);
    }));

    this._attached.set(sessionId, { transport, subscriptions, daemonSeq: 0, candidateKeys });
  }

  async detachSession(sessionId: string): Promise<void> {
    const att = this._attached.get(sessionId);
    if (!att) {
      return;
    }
    for (const sub of att.subscriptions) {
      sub.unsubscribe();
    }
    try {
      await att.transport.disconnect();
    } catch (err) {
      this._logService.warn(`[ShareDaemonService] transport.disconnect failed for ${sessionId}:`, err);
    }
    this._attached.delete(sessionId);
    this._metadataCache.delete(sessionId);
  }

  private _handleInboundFrame(sessionId: string, source: string, frame: IFrame): void {
    if (frame.channel === FrameChannel.Control) {
      // Inspect for client_join before delegating to mux. mux.handleInbound for
      // an unknown clientId is a no-op, so without this branch the joiner can
      // never register itself.
      const parsed = tryDecodeControl(frame.payload);
      if (parsed?.type && parsed.type !== 'heartbeat') {
        this._logService.log(`[DRIVER-DEBUG] daemon inbound control sid=${sessionId} source=${source} type=${parsed.type}`);
      }
      if (parsed?.type === 'client_join') {
        const role = parsed.role as SharedTerminalRole;
        const pubB64 = parsed.userPublicKey;
        if (typeof pubB64 !== 'string') {
          this._logService.warn('[ShareDaemonService] client_join missing userPublicKey');
          this._sendErrorToClient(sessionId, source, 'invalid_client_join');
          return;
        }
        const publicKey = base64UrlToBytes(pubB64);
        const displayName = typeof parsed.displayName === 'string' ? parsed.displayName : undefined;
        try {
          this._mux.attachClient(sessionId, source, role, displayName, publicKey);
          // Unicast the cached session_metadata to the new joiner so their tab
          // title matches the owner immediately — without this they only see
          // updates that happen AFTER their attach.
          this._sendMetadataToClient(sessionId, source);
        } catch (err) {
          // mux throws `unknown session` when the PTY hasn't been registered.
          this._logService.error('[ShareDaemonService] mux.attachClient failed:', err);
          const reason = err instanceof Error ? err.message : String(err);
          this._sendErrorToClient(sessionId, source, reason);
        }
        return;
      }
    }
    try {
      this._mux.handleInbound(sessionId, source, frame);
    } catch (err) {
      this._logService.warn('[ShareDaemonService] mux.handleInbound threw:', err);
    }
  }

  private _tryParseDebugPayload(payload: Uint8Array): { type?: string; fromClientId?: string | null; toClientId?: string | null } | null {
    try {
      return JSON.parse(new TextDecoder().decode(payload)) as { type?: string; fromClientId?: string | null; toClientId?: string | null };
    } catch {
      return null;
    }
  }

  /**
   * Unicast a `{type:'error', reason}` Control frame back to a specific
   * joiner. Used when attachClient fails (e.g. owner's PTY isn't registered
   * yet) so the joiner's UI surfaces a real error instead of hanging in the
   * Connecting state forever.
   */
  private _sendErrorToClient(sessionId: string, clientId: string, reason: string): void {
    const att = this._attached.get(sessionId);
    if (!att) {
      return;
    }
    const seq = att.daemonSeq;
    att.daemonSeq = (seq + 1) >>> 0;
    const payload = new TextEncoder().encode(JSON.stringify({ type: 'error', reason }));
    try {
      att.transport.send(
        { channel: FrameChannel.Control, flags: FrameFlag.None, seq, payload },
        { target: clientId }
      );
    } catch (err) {
      this._logService.warn('[ShareDaemonService] failed to send error frame:', err);
    }
  }

  pushSessionMetadata(sessionId: string, metadata: { ownerLabel?: string | null; title?: string | null }): void {
    // `undefined` means "leave this field alone"; `null` means "the caller
    // explicitly cleared this field" (e.g. owner signed out). We need both
    // signals to make it across the wire so joiners can clear a previously
    // shown label/title — the cache delete branches below implement the
    // null semantics; the JSON serialiser drops `undefined` so the joiner
    // only sees keys that the owner meant to set or clear.
    const ownerLabelTouched = metadata.ownerLabel !== undefined;
    const titleTouched = metadata.title !== undefined;

    // Prime the cache even when the payload is empty: this lets callers seed
    // an entry at attachSession time before ownerLabel/title is known, so the
    // first new joiner sees a consistent "session exists, nothing to push
    // yet" state rather than no entry at all. Wire send is gated separately.
    const cached = this._metadataCache.get(sessionId) ?? {};
    const merged: { ownerLabel?: string; title?: string } = { ...cached };
    if (ownerLabelTouched) {
      if (metadata.ownerLabel === null) {
        delete merged.ownerLabel;
      } else {
        merged.ownerLabel = metadata.ownerLabel;
      }
    }
    if (titleTouched) {
      if (metadata.title === null) {
        delete merged.title;
      } else {
        merged.title = metadata.title;
      }
    }
    this._metadataCache.set(sessionId, merged);

    if (!ownerLabelTouched && !titleTouched) {
      // Caller just wanted to prime the cache; no need to wake the relay.
      return;
    }

    const att = this._attached.get(sessionId);
    if (!att) {
      return;
    }
    const seq = att.daemonSeq;
    att.daemonSeq = (seq + 1) >>> 0;
    const payload = this._encodeMetadataPayload(sessionId, {
      ownerLabel: ownerLabelTouched ? (metadata.ownerLabel ?? null) : undefined,
      title: titleTouched ? (metadata.title ?? null) : undefined,
    });
    try {
      att.transport.send(
        { channel: FrameChannel.SessionEvent, flags: FrameFlag.None, seq, payload },
        { target: 'broadcast' }
      );
    } catch (err) {
      this._logService.warn(`[ShareDaemonService] pushSessionMetadata failed for ${sessionId}:`, err);
    }
  }

  /**
   * Unicast the cached session_metadata to a single newly-joined client. Used
   * inside client_join handling so the joiner's tab title reflects the owner's
   * current state right away instead of waiting for the next title change.
   */
  private _sendMetadataToClient(sessionId: string, clientId: string): void {
    const cached = this._metadataCache.get(sessionId);
    if (!cached || (cached.ownerLabel === undefined && cached.title === undefined)) {
      return;
    }
    const att = this._attached.get(sessionId);
    if (!att) {
      return;
    }
    const seq = att.daemonSeq;
    att.daemonSeq = (seq + 1) >>> 0;
    // For new joiners we forward the cached values (never null — null is the
    // "explicitly cleared" signal which only makes sense for already-attached
    // clients that had the prior value).
    const payload = this._encodeMetadataPayload(sessionId, cached);
    try {
      att.transport.send(
        { channel: FrameChannel.SessionEvent, flags: FrameFlag.None, seq, payload },
        { target: clientId }
      );
    } catch (err) {
      this._logService.warn(`[ShareDaemonService] _sendMetadataToClient failed for ${sessionId}/${clientId}:`, err);
    }
  }

  private _encodeMetadataPayload(sessionId: string, metadata: { ownerLabel?: string | null; title?: string | null }): Uint8Array {
    const event: Record<string, unknown> = {
      type: 'session_metadata',
      sessionId,
    };
    if (metadata.ownerLabel !== undefined) {
      event.ownerLabel = metadata.ownerLabel;
    }
    if (metadata.title !== undefined) {
      event.title = metadata.title;
    }
    return new TextEncoder().encode(JSON.stringify(event));
  }
}

function tryDecodeControl(payload: Uint8Array): Nullable<Record<string, unknown>> {
  try {
    return JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = globalThis.atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
