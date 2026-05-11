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

import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions, IPairedDevice, IPairingService, ISharedTerminalCryptoService, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import { Disposable, IConfigService, Inject } from '@termlnk/core';
import { ISharedTerminalCryptoService as ISharedTerminalCryptoServiceId, SHARED_TERMINAL_CAPABILITY_VERSION, SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { bytesToBase64Url } from '../utils/encoding';

export class PairingService extends Disposable implements IPairingService {
  private readonly _pairedDevices$ = new BehaviorSubject<readonly IPairedDevice[]>([]);
  readonly pairedDevices$ = this._pairedDevices$.asObservable();

  private readonly _outstandingInvites$ = new BehaviorSubject<readonly ICollabInvite[]>([]);
  readonly outstandingInvites$ = this._outstandingInvites$.asObservable();

  private readonly _inviteClaims$ = new Subject<IInviteClaimResult>();
  readonly inviteClaims$ = this._inviteClaims$.asObservable();

  constructor(
    @Inject(IConfigService) private readonly _configService: IConfigService,
    @Inject(ISharedTerminalCryptoServiceId) private readonly _crypto: ISharedTerminalCryptoService
  ) {
    super();
  }

  override dispose(): void {
    this._pairedDevices$.complete();
    this._outstandingInvites$.complete();
    this._inviteClaims$.complete();
    super.dispose();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    const next = this._pairedDevices$.getValue().filter((device) => device.id !== deviceId);
    this._pairedDevices$.next(next);
  }

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    const relayBaseUrl = this._relayBaseUrl();
    if (!relayBaseUrl) {
      throw new Error('[PairingService] relayBaseUrl is required before creating invite');
    }

    const now = Date.now();
    const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
      ? options.ttlMs
      : SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS;
    const inviteId = bytesToBase64Url(this._crypto.randomBytes(24));
    const eph = this._crypto.generateKeypair();
    const sessionId = options.sessionId ?? bytesToBase64Url(this._crypto.randomBytes(32));
    const capability = {
      v: SHARED_TERMINAL_CAPABILITY_VERSION,
      sid: sessionId,
      role: options.role,
      exp: Math.min(now + ttlMs, Number.MAX_SAFE_INTEGER),
      nonce: bytesToBase64Url(this._crypto.randomBytes(16)),
    };
    const invite: ICollabInvite = {
      inviteId,
      ephPriv: bytesToBase64Url(eph.secretKey),
      ephPub: bytesToBase64Url(eph.publicKey),
      capability,
      singleUse: options.singleUse,
    };

    this._outstandingInvites$.next([...this._outstandingInvites$.getValue(), invite]);
    const fragment = encodeURIComponent(JSON.stringify({ ephPriv: invite.ephPriv, capability }));
    const url = `${relayBaseUrl.replace(/^wss?:\/\//, 'https://').replace(/\/+$/, '')}/s/${inviteId}#${fragment}`;
    return { invite, url };
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const next = this._outstandingInvites$.getValue().filter((invite) => invite.inviteId !== inviteId);
    this._outstandingInvites$.next(next);
  }

  private _relayBaseUrl(): string | undefined {
    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY
    );
    return config?.relayBaseUrl?.replace(/\/+$/, '');
  }
}
