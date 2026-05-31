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

import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions, IInviteService, IInviteTokenState, IPairedDevice, IPairingService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { IPairingService as IPairingServiceId } from '@termlnk/shared-terminal';
import { IDeepLinkRouterService } from '../deep-link/deep-link-router.service';

/**
 * Owner-side invite lifecycle + deep-link inflow. Implements `IInviteService`
 * by composing `IPairingService` (invite CRUD + paired devices) with the
 * process-local `IDeepLinkRouterService` (OS-level termlnk:// URLs forwarded
 * from electron-main).
 *
 * Separation rationale: `IPairingService` lives in shared-terminal-core (no
 * Electron dependency); `IDeepLinkRouterService` lives in rpc-server because the
 * electron-main DeepLinkController emits into it. Composing them here keeps
 * the contract surface clean for the renderer.
 */
export class InviteService extends Disposable implements IInviteService {
  constructor(
    @IPairingServiceId private readonly _pairing: IPairingService,
    @IDeepLinkRouterService private readonly _deepLinks: IDeepLinkRouterService
  ) {
    super();
  }

  get outstandingInvites$(): Observable<readonly IInviteTokenState[]> {
    return this._pairing.outstandingInvites$;
  }

  get inviteHistory$(): Observable<readonly IInviteTokenState[]> {
    return this._pairing.inviteHistory$;
  }

  get inviteClaims$(): Observable<IInviteClaimResult> {
    return this._pairing.inviteClaims$;
  }

  get pairedDevices$(): Observable<readonly IPairedDevice[]> {
    return this._pairing.pairedDevices$;
  }

  get inviteUrl$(): Observable<string> {
    return this._deepLinks.route('invite');
  }

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    return this._pairing.createInvite(options);
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this._pairing.revokeInvite(inviteId);
  }

  async listInvites(): Promise<readonly IInviteTokenState[]> {
    return this._pairing.listInvites();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this._pairing.revokeDevice(deviceId);
  }
}
