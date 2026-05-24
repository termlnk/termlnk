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
  /** Per-session control-channel seq for daemon-initiated error frames. */
  errorSeq: number;
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

    this._attached.set(sessionId, { transport, subscriptions, errorSeq: 0, candidateKeys });
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
  }

  private _handleInboundFrame(sessionId: string, source: string, frame: IFrame): void {
    if (frame.channel === FrameChannel.Control) {
      // Inspect for client_join before delegating to mux. mux.handleInbound for
      // an unknown clientId is a no-op, so without this branch the joiner can
      // never register itself.
      const parsed = tryDecodeControl(frame.payload);
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
        } catch (err) {
          // mux throws `unknown session` when the PTY hasn't been registered.
          // Surface a control-error frame back to the joiner so the UI shows
          // a real failure instead of leaving them stuck at "Connecting".
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
    const seq = att.errorSeq;
    att.errorSeq = (seq + 1) >>> 0;
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
