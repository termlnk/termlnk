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

import type { ClientConnectionState, ICollabInvite, IDriverState, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState, IPairedDevice, IParticipant, IParticipantConnectResult, IParticipantFrame, IParticipantSnapshot, IRemoteAnnouncedSession, IShareableSession, ISharedSession, ISharedTerminalService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Optional } from '@termlnk/core';
import { IDevicePairingService, IPairingService, IParticipantService, IPtyMultiplexerService } from '@termlnk/shared-terminal';
import { EMPTY, firstValueFrom } from 'rxjs';
import { IDeepLinkBus } from './deep-link.bus';
import { IShareSessionService } from './share-session.service';

export class SharedTerminalService extends Disposable implements ISharedTerminalService {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @Optional(IPtyMultiplexerService) private readonly _mux?: IPtyMultiplexerService,
    @Optional(IPairingService) private readonly _pairing?: IPairingService,
    @Optional(IParticipantService) private readonly _participant?: IParticipantService,
    @Optional(IDevicePairingService) private readonly _devicePairing?: IDevicePairingService,
    @Optional(IShareSessionService) private readonly _share?: IShareSessionService,
    @Optional(IDeepLinkBus) private readonly _deepLinks?: IDeepLinkBus
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
  }

  get sessions$(): Observable<readonly ISharedSession[]> {
    return this._mux?.sessions$ ?? EMPTY;
  }

  async listSessions(): Promise<readonly ISharedSession[]> {
    if (!this._mux) {
      return [];
    }
    return firstValueFrom(this._mux.sessions$);
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    return this._mux?.participants$(sessionId) ?? EMPTY;
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    return this._mux?.driverState$(sessionId) ?? EMPTY;
  }

  async setDriver(sessionId: string, clientId: string | null): Promise<void> {
    this._requireMux().setDriver(sessionId, clientId);
  }

  async lockDriver(sessionId: string, clientId: string): Promise<void> {
    this._requireMux().lockDriver(sessionId, clientId);
  }

  async unlockDriver(sessionId: string): Promise<void> {
    this._requireMux().unlockDriver(sessionId);
  }

  async kick(sessionId: string, clientId: string, reason?: string): Promise<void> {
    this._requireMux().kick(sessionId, clientId, reason);
  }

  get outstandingInvites$(): Observable<readonly IInviteTokenState[]> {
    return this._pairing?.outstandingInvites$ ?? EMPTY;
  }

  get inviteHistory$(): Observable<readonly IInviteTokenState[]> {
    return this._pairing?.inviteHistory$ ?? EMPTY;
  }

  get inviteClaims$(): Observable<IInviteClaimResult> {
    return this._pairing?.inviteClaims$ ?? EMPTY;
  }

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    return this._requirePairing().createInvite(options);
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this._requirePairing().revokeInvite(inviteId);
  }

  async listInvites(): Promise<readonly IInviteTokenState[]> {
    if (!this._pairing) {
      return [];
    }
    return this._pairing.listInvites();
  }

  get pairedDevices$(): Observable<readonly IPairedDevice[]> {
    return this._pairing?.pairedDevices$ ?? EMPTY;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this._requirePairing().revokeDevice(deviceId);
  }

  get shareable$(): Observable<readonly IShareableSession[]> {
    return this._share?.shareable$ ?? EMPTY;
  }

  async listShareable(): Promise<readonly IShareableSession[]> {
    if (!this._share) {
      return [];
    }
    return this._share.listShareable();
  }

  async shareSshSession(sessionId: string): Promise<void> {
    await this._requireShare().shareSshSession(sessionId);
  }

  async sharePtySession(sessionId: string): Promise<void> {
    await this._requireShare().sharePtySession(sessionId);
  }

  async stopSharing(sessionId: string): Promise<void> {
    await this._requireShare().stopSharing(sessionId);
  }

  get inviteUrl$(): Observable<string> {
    return this._deepLinks?.url$ ?? EMPTY;
  }

  get participantState$(): Observable<ClientConnectionState> {
    return this._participant?.state$ ?? EMPTY;
  }

  get participantFrames$(): Observable<IParticipantFrame> {
    return this._participant?.frames$ ?? EMPTY;
  }

  get participantSnapshot$(): Observable<IParticipantSnapshot | null> {
    return this._participant?.snapshot$ ?? EMPTY;
  }

  get participantLastError$(): Observable<string | null> {
    return this._participant?.lastError$ ?? EMPTY;
  }

  get participantConnectionId$(): Observable<string | null> {
    return this._participant?.currentConnectionId$ ?? EMPTY;
  }

  get participantSessionId$(): Observable<string | null> {
    return this._participant?.currentSessionId$ ?? EMPTY;
  }

  async connectAsParticipant(inviteUrl: string): Promise<IParticipantConnectResult> {
    return this._requireParticipant().connect({ inviteUrl });
  }

  async disconnectParticipant(): Promise<void> {
    await this._requireParticipant().disconnect();
  }

  async sendParticipantInput(data: Uint8Array): Promise<void> {
    await this._requireParticipant().sendInput(data);
  }

  async sendParticipantControl(message: object): Promise<void> {
    await this._requireParticipant().sendControl(message);
  }

  get remoteSessions$(): Observable<readonly IRemoteAnnouncedSession[]> {
    return this._devicePairing?.remoteSessions$ ?? EMPTY;
  }

  async listRemoteSessions(): Promise<readonly IRemoteAnnouncedSession[]> {
    if (!this._devicePairing) {
      return [];
    }
    return this._devicePairing.list();
  }

  async refreshRemoteSessions(): Promise<void> {
    await this._requireDevicePairing().refresh();
  }

  async announceDeviceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void> {
    await this._requireDevicePairing().announceSession(sessionId, title, cols, rows);
  }

  async retractDeviceSession(sessionId: string): Promise<void> {
    await this._requireDevicePairing().retractSession(sessionId);
  }

  private _requireMux(): IPtyMultiplexerService {
    if (!this._mux) {
      throw new Error('[SharedTerminalService] PtyMultiplexerService is unavailable in this runtime');
    }
    return this._mux;
  }

  private _requirePairing(): IPairingService {
    if (!this._pairing) {
      throw new Error('[SharedTerminalService] PairingService is unavailable in this runtime');
    }
    return this._pairing;
  }

  private _requireParticipant(): IParticipantService {
    if (!this._participant) {
      throw new Error('[SharedTerminalService] ParticipantClientService is unavailable in this runtime');
    }
    return this._participant;
  }

  private _requireDevicePairing(): IDevicePairingService {
    if (!this._devicePairing) {
      throw new Error('[SharedTerminalService] DevicePairingService is unavailable in this runtime');
    }
    return this._devicePairing;
  }

  private _requireShare(): IShareSessionService {
    if (!this._share) {
      throw new Error('[SharedTerminalService] ShareSessionService is unavailable in this runtime');
    }
    return this._share;
  }
}
