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

import type { CollabInviteStatus as DbCollabInviteStatus, ICollabInviteTokenEntity } from '@termlnk/database';
import type { CollabInviteStatus, ICapability, ICollabInvite, ICollabInviteTransportService, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState, IPairedDevice, IPairingService, ISharedTerminalPluginConfig, SharedTerminalRole } from '@termlnk/shared-terminal';
import { Disposable, IConfigService, ILogService, Inject, Optional } from '@termlnk/core';
import { CollabInviteTokenRepository } from '@termlnk/database';
import { ICollabInviteTransportService as ICollabInviteTransportServiceId, IDaemonKeypairService, ISharedTerminalCryptoService, SHARED_TERMINAL_CAPABILITY_VERSION, SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { computeCapabilityHash } from '../utils/capability-hash';
import { bytesToBase64Url } from '../utils/encoding';

/**
 * Owner-side invite lifecycle.
 *
 * State source of truth: the local SQLite collab_invite_token table. Server push is
 * a best-effort mirror so a separate device (or the same machine after re-install)
 * can reconcile its view via `GET /v1/collab/invite`. ephPriv NEVER hits the wire.
 *
 * Failure modes:
 *   - HTTP push fails: local row stays `serverSyncedAt = null`. A future syncNow
 *     hook drains these. Owner can still share the URL because the relay
 *     path validates the locally-signed envelope.
 *   - Invite expires while running: startup sweep + on-demand `_reconcileExpiry`
 *     transition active rows past `exp` to `expired`.
 */
export class PairingService extends Disposable implements IPairingService {
  private readonly _pairedDevices$ = new BehaviorSubject<readonly IPairedDevice[]>([]);
  readonly pairedDevices$ = this._pairedDevices$.asObservable();

  private readonly _outstandingInvites$ = new BehaviorSubject<readonly IInviteTokenState[]>([]);
  readonly outstandingInvites$ = this._outstandingInvites$.asObservable();

  private readonly _inviteHistory$ = new BehaviorSubject<readonly IInviteTokenState[]>([]);
  readonly inviteHistory$ = this._inviteHistory$.asObservable();

  private readonly _inviteClaims$ = new Subject<IInviteClaimResult>();
  readonly inviteClaims$ = this._inviteClaims$.asObservable();

  private _refreshing = false;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ISharedTerminalCryptoService private readonly _cryptoService: ISharedTerminalCryptoService,
    @IDaemonKeypairService private readonly _daemonKeypairService: IDaemonKeypairService,
    @Inject(CollabInviteTokenRepository) private readonly _repo: CollabInviteTokenRepository,
    @ILogService private readonly _logService: ILogService,
    @Optional(ICollabInviteTransportServiceId) private readonly _transportService?: ICollabInviteTransportService
  ) {
    super();

    void this._bootstrap();
  }

  override dispose(): void {
    this._pairedDevices$.complete();
    this._outstandingInvites$.complete();
    this._inviteHistory$.complete();
    this._inviteClaims$.complete();
    super.dispose();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    const next = this._pairedDevices$.getValue().filter((device) => device.id !== deviceId);
    this._pairedDevices$.next(next);
  }

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    const relayBaseUrl = this._baseUrl('relayBaseUrl');
    if (!relayBaseUrl) {
      throw new Error('[PairingService] relayBaseUrl is required before creating invite');
    }
    const inviteBaseUrl = this._baseUrl('inviteBaseUrl');
    if (!inviteBaseUrl) {
      throw new Error('[PairingService] inviteBaseUrl is required before creating invite');
    }
    const now = Date.now();
    const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
      ? options.ttlMs
      : SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS;
    const inviteId = bytesToBase64Url(this._cryptoService.randomBytes(24));
    const eph = this._cryptoService.generateKeypair();
    const sessionId = options.sessionId ?? bytesToBase64Url(this._cryptoService.randomBytes(32));
    // Daemon long-term X25519 public key — joiner uses it together with the fragment's
    // ephPriv to derive the same sharedKey we will use on the owner side. Without this
    // the joiner falls back to an all-zero key and every relay frame fails to open.
    const daemonKeypair = await this._daemonKeypairService.getOrCreate();
    const capability: ICapability = {
      v: SHARED_TERMINAL_CAPABILITY_VERSION,
      sid: sessionId,
      role: options.role,
      exp: Math.min(now + ttlMs, Number.MAX_SAFE_INTEGER),
      nonce: bytesToBase64Url(this._cryptoService.randomBytes(16)),
      daemonPub: bytesToBase64Url(daemonKeypair.publicKey),
    };
    const capabilityHash = await computeCapabilityHash(capability);
    const ephPrivB64 = bytesToBase64Url(eph.secretKey);
    const ephPubB64 = bytesToBase64Url(eph.publicKey);

    await this._repo.insert({
      inviteId,
      sessionId,
      role: capability.role,
      capabilityHash,
      capabilityVersion: capability.v,
      capabilityNonce: capability.nonce,
      ephPubB64,
      ephPrivCipher: ephPrivB64,
      exp: capability.exp,
      singleUse: options.singleUse,
      status: 'active',
      note: options.note,
      createdAt: now,
    });

    const invite: ICollabInvite = {
      inviteId,
      ephPriv: ephPrivB64,
      ephPub: ephPubB64,
      capability,
      capabilityHash,
      createdAt: now,
      status: 'active',
      singleUse: options.singleUse,
    };

    // Best-effort server push; never block the owner UX on cloud availability.
    if (this._transportService) {
      try {
        await this._transportService.pushCreate({
          inviteId,
          sessionId,
          role: capability.role,
          capability,
          capabilityHash,
          ephPubB64,
          exp: capability.exp,
          singleUse: options.singleUse,
          note: options.note,
        });
        await this._repo.markServerSynced(inviteId, Date.now());
      } catch (err) {
        this._logService.warn('[PairingService] server pushCreate failed (offline-first; will retry):', err);
      }
    }

    await this._refresh();

    const url = this._buildInviteUrl(inviteBaseUrl, inviteId, ephPrivB64, capability);
    return { invite, url };
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const row = await this._repo.getById(inviteId);
    if (!row) {
      return;
    }
    if (row.status !== 'active') {
      // Idempotent: nothing to do.
      return;
    }
    await this._repo.markRevoked(inviteId, Date.now());

    if (this._transportService) {
      try {
        await this._transportService.pushRevoke(inviteId);
        await this._repo.markServerSynced(inviteId, Date.now());
      } catch (err) {
        this._logService.warn('[PairingService] server pushRevoke failed (offline-first; will retry):', err);
      }
    }

    await this._refresh();
  }

  async listInvites(): Promise<readonly IInviteTokenState[]> {
    const rows = await this._repo.listAll();
    return rows.map(toTokenState);
  }

  /**
   * Mark an invite as consumed when relay/daemon confirms a successful claim. Public so
   * the relay-side claim handler can update lifecycle without
   * crossing back into PairingService internals.
   */
  async consumeInvite(inviteId: string): Promise<void> {
    const row = await this._repo.getById(inviteId);
    if (!row || row.status !== 'active') {
      return;
    }
    await this._repo.markConsumed(inviteId, Date.now());
    await this._refresh();
  }

  /**
   * Drain known invites past their `exp`. Idempotent — safe to call repeatedly. Invoked
   * at startup and whenever the caller wants to refresh derived UI state.
   */
  async reconcileExpiry(now: number = Date.now()): Promise<void> {
    const expired = await this._repo.listExpiredActive(now);
    if (expired.length === 0) {
      return;
    }
    await this._repo.markExpired(expired.map((row) => row.inviteId));
    await this._refresh();
  }

  private async _bootstrap(): Promise<void> {
    try {
      await this.reconcileExpiry();
      await this._refresh();
    } catch (err) {
      this._logService.error('[PairingService] bootstrap failed:', err);
    }
  }

  private async _refresh(): Promise<void> {
    // Coalesce concurrent refreshes. The repository is fast enough that a small
    // run-while-busy loop is unnecessary — readers will pick up the next emission.
    if (this._refreshing) {
      return;
    }
    this._refreshing = true;
    try {
      const rows = await this._repo.listAll();
      const all = rows.map(toTokenState);
      const outstanding = all.filter((state) => state.status === 'active');
      this._outstandingInvites$.next(outstanding);
      this._inviteHistory$.next(all);
    } finally {
      this._refreshing = false;
    }
  }

  private _buildInviteUrl(inviteBaseUrl: string, inviteId: string, ephPrivB64: string, capability: ICapability): string {
    const fragment = encodeURIComponent(JSON.stringify({ ephPriv: ephPrivB64, capability }));
    return `${inviteBaseUrl}/s/${inviteId}#${fragment}`;
  }

  private _baseUrl(field: 'relayBaseUrl' | 'inviteBaseUrl'): string | undefined {
    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY
    );
    return config?.[field]?.replace(/\/+$/, '');
  }
}

function toTokenState(row: ICollabInviteTokenEntity): IInviteTokenState {
  return {
    inviteId: row.inviteId,
    sessionId: row.sessionId,
    role: row.role as SharedTerminalRole,
    capabilityHash: row.capabilityHash,
    exp: row.exp,
    singleUse: row.singleUse,
    status: row.status as CollabInviteStatus as DbCollabInviteStatus,
    createdAt: row.createdAt,
    consumedAt: row.consumedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
    note: row.note ?? undefined,
  };
}
