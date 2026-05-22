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
import type { IDevicePairingService, IRemoteAnnouncedSession, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { AUTH_DEVICE_ID_STORAGE_KEY, IAuthKeyValueStorage, ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService, Optional } from '@termlnk/core';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { BehaviorSubject } from 'rxjs';

const POLL_INTERVAL_MS = 60_000;

/**
 * Same-account multi-device discovery client.
 *
 * Each device:
 *   - POSTs `/v1/multiplayer/announce` whenever it starts sharing a session.
 *     Body includes `deviceId` (matches the same id AuthCorePlugin persists for
 *     login) + `deviceClock` so the server can route same-account fan-out.
 *   - DELETEs `/v1/multiplayer/announce/:sessionId` on stopSharing.
 *   - Polls `GET /v1/multiplayer/sessions` every 60 s to refresh the index.
 *
 * Until the cloud endpoint is deployed, `_baseUrl` returns null and every call
 * is a no-op that resolves successfully — the renderer's "From other devices"
 * list stays empty without surfacing errors.
 */
export class DevicePairingService extends Disposable implements IDevicePairingService {
  private readonly _remoteSessions$ = new BehaviorSubject<readonly IRemoteAnnouncedSession[]>([]);
  readonly remoteSessions$: Observable<readonly IRemoteAnnouncedSession[]> = this._remoteSessions$.asObservable();

  private _pollTimer: Nullable<NodeJS.Timeout> = null;
  private _deviceIdCache: Nullable<string> = null;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @Optional(ITokenManager) private readonly _tokenManager?: ITokenManager,
    @Optional(IAuthKeyValueStorage) private readonly _authStorage?: IAuthKeyValueStorage
  ) {
    super();
    if (this._baseUrl()) {
      this._pollTimer = setInterval(() => {
        void this.refresh();
      }, POLL_INTERVAL_MS);
      this._pollTimer.unref?.();
    }
  }

  override dispose(): void {
    super.dispose();
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._remoteSessions$.complete();
  }

  async list(): Promise<readonly IRemoteAnnouncedSession[]> {
    return this._remoteSessions$.getValue();
  }

  async announceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void> {
    const base = this._baseUrl();
    if (!base) {
      return;
    }
    const token = await this._authHeader();
    if (!token) {
      return;
    }
    const deviceId = await this._deviceId();
    if (!deviceId) {
      this._logService.warn('[DevicePairingService] no deviceId available; skipping announce');
      return;
    }
    try {
      const res = await fetch(`${base}/multiplayer/announce`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: token },
        body: JSON.stringify({
          deviceId,
          sessionId,
          title,
          cols,
          rows,
          deviceClock: Date.now(),
        }),
      });
      if (!res.ok) {
        this._logService.error(`[DevicePairingService] announce returned ${res.status}`);
      }
    } catch (err) {
      this._logService.error('[DevicePairingService] announce failed:', err);
    }
  }

  async retractSession(sessionId: string): Promise<void> {
    const base = this._baseUrl();
    if (!base) {
      return;
    }
    const token = await this._authHeader();
    if (!token) {
      return;
    }
    try {
      await fetch(`${base}/multiplayer/announce/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { authorization: token },
      });
    } catch (err) {
      this._logService.error('[DevicePairingService] retract failed:', err);
    }
  }

  async refresh(): Promise<void> {
    const base = this._baseUrl();
    if (!base) {
      this._remoteSessions$.next([]);
      return;
    }
    const token = await this._authHeader();
    if (!token) {
      this._remoteSessions$.next([]);
      return;
    }
    try {
      const res = await fetch(`${base}/multiplayer/sessions`, {
        headers: { authorization: token },
      });
      if (!res.ok) {
        this._logService.error(`[DevicePairingService] list returned ${res.status}`);
        return;
      }
      const body = (await res.json()) as { sessions?: IRemoteAnnouncedSession[] };
      this._remoteSessions$.next(body.sessions ?? []);
    } catch (err) {
      this._logService.error('[DevicePairingService] refresh failed:', err);
    }
  }

  private _baseUrl(): string | null {
    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    return config?.cloudBaseUrl?.replace(/\/+$/, '') ?? null;
  }

  private async _authHeader(): Promise<string | null> {
    if (!this._tokenManager) {
      return null;
    }
    try {
      const token = await this._tokenManager.getAccessToken();
      return token ? `Bearer ${token}` : null;
    } catch {
      return null;
    }
  }

  /**
   * Returns the persisted auth device id so server-side `delete-all-by-device` lines up
   * with the AuthCorePlugin registration on /auth/srp/verify. If the auth storage isn't
   * registered (e.g. unit tests / mobile minimal core), we surface null instead of
   * minting a fresh id — that would silently fragment server-side announcement rows.
   */
  private async _deviceId(): Promise<string | null> {
    if (this._deviceIdCache) {
      return this._deviceIdCache;
    }
    if (!this._authStorage) {
      return null;
    }
    try {
      const stored = await this._authStorage.getString(AUTH_DEVICE_ID_STORAGE_KEY);
      if (stored && stored.length > 0) {
        this._deviceIdCache = stored;
        return stored;
      }
    } catch (err) {
      this._logService.warn('[DevicePairingService] deviceId read failed:', err);
    }
    return null;
  }
}
