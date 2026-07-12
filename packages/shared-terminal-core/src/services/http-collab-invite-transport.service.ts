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

import type { ICollabInviteClaimInput, ICollabInviteClaimResponse, ICollabInviteCreateInput, ICollabInviteServerView, ICollabInviteTransportService, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import { HttpRequestError, ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { DEFAULT_CLOUD_BASE_URL, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';

/**
 * Subsettable fetch — same shape used by HttpSyncTransportService for testability.
 */
export type CollabHttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

const DEFAULT_FETCH_FN: CollabHttpFetchFn = async (url, init) => {
  const resp = await globalThis.fetch(url, init as RequestInit);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

/**
 * Wire format (mirror of termlnk-server /v1/collab/invite/{create,revoke,list}):
 *
 * ```
 * POST {baseUrl}/collab/invite
 *   Body: ICollabInviteCreateInput
 *   Response: { invite: ICollabInviteServerView }
 *
 * POST {baseUrl}/collab/invite/:inviteId/revoke
 *   Body: empty
 *   Response: 204 No Content  // server-side: clients refresh via GET /collab/invite
 *
 * GET  {baseUrl}/collab/invite
 *   Response: { invites: ICollabInviteServerView[] }
 * ```
 */
export class HttpCollabInviteTransportService extends Disposable implements ICollabInviteTransportService {
  constructor(
    @ITokenManager private readonly _tokenManager: ITokenManager,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async pushCreate(input: ICollabInviteCreateInput): Promise<void> {
    const url = this._joinUrl('/collab/invite');
    await this._fetchAuthorized(url, 'POST', input);
  }

  async pushRevoke(inviteId: string): Promise<void> {
    const url = this._joinUrl(`/collab/invite/${encodeURIComponent(inviteId)}/revoke`);
    await this._fetchAuthorized(url, 'POST', {});
  }

  async claim(inviteId: string, input: ICollabInviteClaimInput): Promise<ICollabInviteClaimResponse> {
    const url = this._joinUrl(`/collab/invite/${encodeURIComponent(inviteId)}/claim`);
    // Claim is the one receiver-side call: it accepts anonymous callers
    // (invite possession is the admission proof), so a missing access token
    // just means the Authorization header is omitted. Owner-side calls above
    // stay strictly authenticated.
    const resp = await this._fetch(url, 'POST', input, { requireAuth: false });
    return await resp.json() as ICollabInviteClaimResponse;
  }

  async list(): Promise<readonly ICollabInviteServerView[]> {
    const url = this._joinUrl('/collab/invite');
    const resp = await this._fetchAuthorized(url, 'GET');
    const json = await resp.json() as { invites?: ICollabInviteServerView[] };
    return json.invites ?? [];
  }

  private _joinUrl(path: string): string {
    const base = this._getCloudBaseUrl().replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private _getCloudBaseUrl(): string {
    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    return config?.cloudBaseUrl || DEFAULT_CLOUD_BASE_URL;
  }

  private async _fetchAuthorized(url: string, method: 'POST' | 'GET', body?: unknown): Promise<{ json: () => Promise<unknown>; text: () => Promise<string> }> {
    return await this._fetch(url, method, body, { requireAuth: true });
  }

  private async _fetch(url: string, method: 'POST' | 'GET', body: unknown, options: { requireAuth: boolean }): Promise<{ json: () => Promise<unknown>; text: () => Promise<string> }> {
    const token = await this._tokenManager.getAccessToken();
    if (!token && options.requireAuth) {
      throw new Error('[HttpCollabInviteTransportService] unauthenticated: no access token available');
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await DEFAULT_FETCH_FN(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new HttpRequestError(`${method} ${url}`, resp.status, resp.statusText, text);
    }
    return { json: () => resp.json(), text: () => resp.text() };
  }
}
